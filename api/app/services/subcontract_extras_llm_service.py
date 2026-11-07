"""
=============================================================================
GADAP Hub - LLM Parser Especializado para WhatsApp com Gírias e Erros de Obra
Arquivo: api/app/services/subcontract_extras_llm_service.py
=============================================================================
"""

import json
import logging
import re
from decimal import Decimal
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("gadap.subcontract_extras_llm")

SYSTEM_PROMPT_BLINDADO = (
    "Você é um assistente de engenharia civil no Brasil especializado em decodificar mensagens informais, "
    "áudios transcritos e textos de WhatsApp enviados por empreiteiros, mestres de obras, pedreiros e eletricistas.\n\n"
    "REGRAS ESTRITAS DE EXTRAÇÃO:\n"
    "1. Ignore saudações, introduções (ex: 'fala mestre', 'boa tarde', 'segue a conta') e totalizadores finais.\n"
    "2. Identifique o serviço executado e corrija erros ortográficos, gírias regionais e abreviações da construção civil "
    "para criar o 'standardized_service' (ex: 'gurme' -> 'Gourmet', 'colocação do piso' -> 'Assentamento de piso', "
    "'registro da gurme' -> 'Instalação de registro de gaveta área gourmet', 'caixinha 4x2' -> 'Instalação de caixa de passagem 4x2').\n"
    "3. Isole o valor total da linha monetária em 'total_line_price' e deduza a quantidade em 'quantity' (padrão 1.0 se implícita ou não detalhada).\n"
    "4. Isole nomes de ajudantes, serventes ou diárias associadas (ex: Tonho, Juninho, Zé, diária do ajudante) no campo 'notes'. "
    "Se houver observações contextuais da execução, inclua também em 'notes'.\n"
    "5. Preserve o trecho original que originou o item no campo 'original_text'.\n\n"
    "FORMATO DE SAÍDA:\n"
    "Retorne EXCLUSIVAMENTE um array JSON de objetos estruturado da seguinte forma, sem markdown, sem explicações adicionais:\n"
    "[\n"
    "  {\n"
    "    \"original_text\": \"...\",\n"
    "    \"standardized_service\": \"...\",\n"
    "    \"quantity\": 1.0,\n"
    "    \"total_line_price\": 150.00,\n"
    "    \"notes\": \"...\"\n"
    "  }\n"
    "]"
)


class SubcontractExtrasLLMService:
    """
    Decodifica mensagens de WhatsApp com orçamentos desestruturados e gírias de obra,
    suportando chamada com GPT-4o-mini (OpenAI) e Gemini 2.5 Flash (Google),
    com fallback determinístico de contingência.
    """

    def __init__(self):
        self.gemini_api_key = settings.GEMINI_API_KEY
        self.openai_api_key = settings.OPENAI_API_KEY
        self.gemini_url = (
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
        )
        self.openai_url = "https://api.openai.com/v1/chat/completions"

    async def parse_raw_whatsapp_text(self, raw_text: str) -> List[Dict[str, Any]]:
        """
        Decodifica o texto bruto usando LLM primário (GPT-4o-mini ou Gemini) ou fallback heurístico.
        """
        if not raw_text or not raw_text.strip():
            return []

        # 1. Tentativa via OpenAI (gpt-4o-mini) se configurada
        if self.openai_api_key:
            try:
                items = await self._call_openai(raw_text)
                if items:
                    return self._sanitize_items(items)
            except Exception as exc:
                logger.warning("Falha na chamada OpenAI (gpt-4o-mini): %s", exc)

        # 2. Tentativa via Google Gemini (gemini-2.5-flash) se configurada
        if self.gemini_api_key:
            try:
                items = await self._call_gemini(raw_text)
                if items:
                    return self._sanitize_items(items)
            except Exception as exc:
                logger.warning("Falha na chamada Gemini: %s", exc)

        # 3. Fallback Heurístico com correção ortográfica de gírias de obra
        return self._heuristic_fallback_parse(raw_text)

    async def _call_openai(self, raw_text: str) -> Optional[List[Dict[str, Any]]]:
        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT_BLINDADO},
                {"role": "user", "content": f"Texto recebido do WhatsApp:\n\"\"\"{raw_text}\"\"\""},
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
        }
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(self.openai_url, headers=headers, json=payload)
            if resp.status_code == 200:
                body = resp.json()
                content = body["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                if isinstance(parsed, list):
                    return parsed
                if isinstance(parsed, dict):
                    return parsed.get("items") or parsed.get("services") or list(parsed.values())[0]
        return None

    async def _call_gemini(self, raw_text: str) -> Optional[List[Dict[str, Any]]]:
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": f"{SYSTEM_PROMPT_BLINDADO}\n\nTexto recebido do WhatsApp:\n\"\"\"{raw_text}\"\"\""}
                    ]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1,
            },
        }
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(f"{self.gemini_url}?key={self.gemini_api_key}", json=payload)
            if resp.status_code == 200:
                body = resp.json()
                candidates = body.get("candidates", [])
                if candidates:
                    raw_json_str = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    clean_str = re.sub(r"^```json\s*", "", raw_json_str, flags=re.MULTILINE)
                    clean_str = re.sub(r"\s*```$", "", clean_str, flags=re.MULTILINE).strip()
                    parsed = json.loads(clean_str)
                    if isinstance(parsed, list):
                        return parsed
                    if isinstance(parsed, dict) and "items" in parsed:
                        return parsed["items"]
        return None

    def _sanitize_items(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        result = []
        for it in items:
            orig = str(it.get("original_text") or "").strip()
            std = str(it.get("standardized_service") or it.get("service") or "").strip()
            if not std and not orig:
                continue

            try:
                qty = float(it.get("quantity") or 1.0)
                if qty <= 0:
                    qty = 1.0
            except (ValueError, TypeError):
                qty = 1.0

            try:
                total_p = float(it.get("total_line_price") or it.get("total") or 0.0)
            except (ValueError, TypeError):
                total_p = 0.0

            notes = str(it.get("notes") or "").strip()

            result.append({
                "original_text": orig or std,
                "standardized_service": std or orig,
                "quantity": round(qty, 2),
                "total_line_price": round(total_p, 2),
                "notes": notes,
            })
        return result

    def _heuristic_fallback_parse(self, raw_text: str) -> List[Dict[str, Any]]:
        """
        Parser heurístico para desestruturados como:
        '2.000,00. Da colocação do piso... com o dia di tonho'
        'registro da gurme 350 reais'
        '10 caixinhas 4x2 500'
        """
        items: List[Dict[str, Any]] = []
        lines = [l.strip() for l in raw_text.splitlines() if l.strip()]

        # Mapeamento de gírias frequentes de obra
        slang_corrections = {
            r"\bgurme\b": "Instalação de registro de gaveta área gourmet",
            r"\bcolocação do piso\b": "Assentamento de piso",
            r"\bpiso\b": "Assentamento de piso",
            r"\bregistro da gurme\b": "Instalação de registro de gaveta área gourmet",
            r"\bcaixinhas?\s*4x2\b": "caixinha 4x2",
            r"\bluminarias?\b": "luminaria led",
            r"\btomadas?\b": "Instalação de tomadas elétricas",
        }

        # Detecção de ajudantes
        helper_pattern = re.compile(
            r"(?:com\s+(?:o\s+)?dia\s+d[ie]\s+|ajudante\s+|diária\s+d[ie]\s+)([A-ZÀ-ÿa-z]+)",
            re.IGNORECASE,
        )

        for line in lines:
            # Ignora saudações e despedidas
            if re.search(r"^(fala\s+mestre|bom\s+dia|boa\s+tarde|total\s+fecha|valeu|abraço|segue\s+os\s+extras)", line.strip("- *•"), re.IGNORECASE):
                continue

            orig_line = line
            # 1. Procura nome de ajudante
            notes = ""
            h_match = helper_pattern.search(line)
            if h_match:
                helper_name = h_match.group(1).capitalize()
                notes = f"Ajudante / diária: {helper_name}"

            # 2. Extrai valor monetário e preço unitário
            # Ex: 10 caixinhas 4x2 a 65 reais cada = 650
            total_price = 0.0
            unit_price = 0.0

            # Procura por "a XX cada = YY"
            mult_match = re.search(r"(?:a|por|de)\s+(\d+(?:[\.,]\d+)?)\s*(?:reais)?\s*(?:cada)?\s*=\s*(\d+(?:[\.,]\d+)?)", line, re.IGNORECASE)
            if mult_match:
                unit_price = float(mult_match.group(1).replace(",", "."))
                total_price = float(mult_match.group(2).replace(",", "."))
            else:
                money_matches = re.findall(r"(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:[\.,]\d+)?)", line)
                if money_matches:
                    raw_val = money_matches[-1].replace(".", "").replace(",", ".")
                    try:
                        total_price = float(raw_val)
                    except ValueError:
                        total_price = 0.0

            # 3. Extrai quantidade se houver (ex: 10 caixinhas)
            qty = 1.0
            qty_match = re.search(r"(\d+)\s*(?:x\s*|un\s*|caixinhas|luminarias|pontos)", line, re.IGNORECASE)
            if qty_match:
                try:
                    qty = float(qty_match.group(1))
                except ValueError:
                    qty = 1.0

            # 4. Limpa texto para gerar o serviço padronizado
            cleaned = re.sub(r"(?:R\$\s*)?\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:[\.,]\d+)?\s*(?:reais)?", "", line, flags=re.IGNORECASE)
            cleaned = re.sub(r"com\s+o\s+dia\s+d[ie]\s+[A-Za-z]+", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"[\.\,\:\-\*]", " ", cleaned).strip()

            std_service = cleaned
            for pattern, repl in slang_corrections.items():
                if re.search(pattern, line, re.IGNORECASE):
                    std_service = repl
                    break

            if not std_service:
                std_service = "Serviço Extra de Campo"

            if unit_price > 0 and total_price == 0.0 and qty > 0:
                total_price = unit_price * qty

            items.append({
                "original_text": orig_line,
                "standardized_service": std_service.strip(),
                "quantity": qty,
                "unit_price": round(unit_price, 2) if unit_price > 0 else (round(total_price / qty, 2) if qty > 0 else 0.0),
                "total_line_price": round(total_price, 2),
                "notes": notes,
            })

        return self._sanitize_items(items) if items else [
            {
                "original_text": raw_text[:80].strip(),
                "standardized_service": "Serviço Extra de Campo",
                "quantity": 1.0,
                "total_line_price": 0.0,
                "notes": "",
            }
        ]
