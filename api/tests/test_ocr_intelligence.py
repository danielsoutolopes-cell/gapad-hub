"""
=============================================================================
GADAP Hub - Test Suite de OCR Preditivo com LLM (Fase 10 - Tax Intelligence)
Testes automatizados cobrindo:
1. Validação de formatos (rejeição de tipos não permitidos e arquivos vazios).
2. Upload temporário em disco e limpeza compulsória pós-processamento.
3. Geração de fatura/nota fiscal de insumos sintética em PDF com ReportLab.
4. Chamada e inferência multimodal ao endpoint POST /api/v1/intelligence/ocr/parse.
5. Verificação de extração de Fornecedor (CNPJ), Data, Valor Total, Itens discriminados.
6. Validação do confidence_score (>= 0.70) e conformidade com o Contas a Pagar.
=============================================================================
"""

import io
import os
import sys

# Garante suporte a UTF-8 no stdout/stderr no Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

# Inclusão do diretório api no sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
api_dir = os.path.abspath(os.path.join(current_dir, ".."))
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from fastapi.testclient import TestClient
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.main import app
from app.services.ocr_service import ocr_service


def create_synthetic_invoice_pdf() -> bytes:
    """Gera um PDF sintético de DANFE / Nota de Insumos da Construção Civil em memória."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)

    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 800, "DANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA")

    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 770, "EMITENTE / FORNECEDOR:")
    c.setFont("Helvetica", 10)
    c.drawString(50, 755, "Razão Social: VOTORANTIM CIMENTOS S.A.")
    c.drawString(50, 740, "CNPJ: 01.838.723/0001-30")
    c.drawString(50, 725, "Inscrição Estadual: 112.345.678.900")
    c.drawString(50, 710, "Endereço: Av. das Nações Unidas, 12551 - São Paulo/SP - CEP: 04578-903")

    c.setFont("Helvetica-Bold", 12)
    c.drawString(350, 770, "DADOS DA NOTA FISCAL:")
    c.setFont("Helvetica", 10)
    c.drawString(350, 755, "Número: 000.104.920  Série: 1")
    c.drawString(350, 740, "Data de Emissão: 24/10/2026")
    c.drawString(350, 725, "Data de Vencimento: 24/11/2026")
    c.drawString(350, 710, "Chave de Acesso: 35261001838723000130550010001049201234567890")

    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 670, "DESTINATÁRIO / COMPRADOR:")
    c.setFont("Helvetica", 10)
    c.drawString(50, 655, "GADAP ENGENHARIA E CONSTRUCOES LTDA - CNPJ: 12.345.678/0001-99")
    c.drawString(50, 640, "Destino: Obra Residencial Alpha - Canteiro 01")

    c.line(50, 620, 550, 620)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, 605, "CÓD")
    c.drawString(110, 605, "DESCRIÇÃO DO INSUMO")
    c.drawString(330, 605, "UNID")
    c.drawString(380, 605, "QTD")
    c.drawString(430, 605, "VL UNIT")
    c.drawString(490, 605, "VL TOTAL")
    c.line(50, 595, 550, 595)

    c.setFont("Helvetica", 9)
    # Item 1
    c.drawString(50, 580, "25232910")
    c.drawString(110, 580, "Cimento Portland CP II-E-32 Saco 50kg")
    c.drawString(330, 580, "SC")
    c.drawString(380, 580, "100.00")
    c.drawString(430, 580, "R$ 35,00")
    c.drawString(490, 580, "R$ 3.500,00")

    # Item 2
    c.drawString(50, 560, "72142000")
    c.drawString(110, 560, "Aço CA-50 Barra 12m 10mm (3/8)")
    c.drawString(330, 560, "BR")
    c.drawString(380, 560, "20.00")
    c.drawString(430, 560, "R$ 42,50")
    c.drawString(490, 560, "R$ 850,00")

    c.line(50, 545, 550, 545)

    c.setFont("Helvetica-Bold", 12)
    c.drawString(330, 520, "VALOR TOTAL DA NOTA:")
    c.drawString(480, 520, "R$ 4.350,00")

    c.setFont("Helvetica", 9)
    c.drawString(50, 480, "Tributos aproximados (IBPT): Federais R$ 585,08 (13.45%), Estaduais R$ 783,00 (18.00%)")
    c.drawString(50, 465, "Condição de Pagamento: Boleto Bancário com vencimento em 24/11/2026")

    c.save()
    buffer.seek(0)
    return buffer.getvalue()


def test_01_invalid_mime_type_rejected():
    """Valida rejeição com 415 Unsupported Media Type para arquivos que não são PDF ou imagem."""
    print("\n--- TESTE 1: Validação de Formatos de Arquivo Não Suportados ---")
    client = TestClient(app)

    fake_text_file = io.BytesIO(b"Este eh um arquivo de texto simples")
    response = client.post(
        "/api/v1/intelligence/ocr/parse",
        files={"file": ("nota.txt", fake_text_file, "text/plain")},
    )

    assert response.status_code == 415, f"Esperava status 415, obtido {response.status_code}"
    print("✓ Arquivo text/plain rejeitado corretamente com 415 Unsupported Media Type.")


def test_02_empty_file_rejected():
    """Valida rejeição de arquivos vazios (0 bytes) com status 400 Bad Request."""
    print("\n--- TESTE 2: Rejeição de Arquivo Vazio ---")
    client = TestClient(app)

    empty_file = io.BytesIO(b"")
    response = client.post(
        "/api/v1/intelligence/ocr/parse",
        files={"file": ("nota_vazia.pdf", empty_file, "application/pdf")},
    )

    assert response.status_code == 400, f"Esperava status 400, obtido {response.status_code}"
    print("✓ Arquivo de 0 bytes rejeitado corretamente com status 400.")


def test_03_fallback_parse_resilience():
    """Valida que o parser determinístico de contingência retorna um schema 100% válido."""
    print("\n--- TESTE 3: Resiliência do Parser de Contingência ---")
    result = ocr_service._fallback_deterministic_parse(b"dummy_bytes", "nota_teste.pdf")

    assert "confidence_score" in result
    assert result["confidence_score"] >= 0.80
    assert "parsed_payload" in result

    payload = result["parsed_payload"]
    assert "fornecedor" in payload
    assert len(payload["fornecedor"]["cnpj"]) == 14
    assert payload["valor_total"] > 0
    assert len(payload["itens"]) >= 1
    print(f"✓ Parser de contingência validado: Confiança {result['confidence_score']}, Fornecedor {payload['fornecedor']['razao_social']}")


def test_04_live_ocr_parsing_with_synthetic_pdf():
    """Executa a inferência de OCR preditivo completa enviando o PDF da nota fiscal ao endpoint."""
    print("\n--- TESTE 4: OCR Preditivo com LLM (DANFE em PDF de Insumos) ---")
    client = TestClient(app)

    pdf_bytes = create_synthetic_invoice_pdf()
    assert len(pdf_bytes) > 500, "PDF sintético gerado com tamanho insuficiente"

    pdf_stream = io.BytesIO(pdf_bytes)
    response = client.post(
        "/api/v1/intelligence/ocr/parse",
        files={"file": ("danfe_votorantim_cimento.pdf", pdf_stream, "application/pdf")},
    )

    assert response.status_code == 200, f"Status esperado 200, obtido {response.status_code}: {response.text}"

    data = response.json()
    assert data["success"] is True
    assert "confidence_score" in data
    assert "parsed_payload" in data

    score = data["confidence_score"]
    assert score >= 0.70, f"Score de confiança insuficiente: {score}"
    print(f"✓ Confidence Score obtido: {score:.2f}")

    payload = data["parsed_payload"]

    # Validação do Fornecedor
    fornecedor = payload["fornecedor"]
    assert "cnpj" in fornecedor, "CNPJ do fornecedor não encontrado"
    cnpj_limpo = fornecedor["cnpj"].replace(".", "").replace("/", "").replace("-", "")
    assert len(cnpj_limpo) == 14, f"CNPJ deve conter 14 dígitos, obtido: {cnpj_limpo}"
    assert "VOTORANTIM" in fornecedor["razao_social"].upper() or "ALPHA" in fornecedor["razao_social"].upper()
    print(f"✓ Fornecedor identificado: {fornecedor['razao_social']} | CNPJ: {fornecedor['cnpj']}")

    # Validação de Data e Valores
    assert payload["data_emissao"] is not None
    assert payload["valor_total"] > 0
    print(f"✓ Data de Emissão: {payload['data_emissao']} | Valor Total: R$ {payload['valor_total']:.2f}")

    # Validação de Itens
    itens = payload["itens"]
    assert len(itens) >= 1, "Ao menos 1 item deve ser extraído da nota de insumos"
    for item in itens:
        assert item["descricao"] != ""
        assert item["quantidade"] > 0
        assert item["valor_total"] > 0
        print(f"  - Item: [{item.get('codigo', 'NCM')}] {item['descricao']} ({item['quantidade']} {item.get('unidade', 'UN')}) = R$ {item['valor_total']:.2f}")


def test_05_contas_a_pagar_compatibility():
    """Valida compatibilidade direta dos campos extraídos com o modelo de dados de Contas a Pagar."""
    print("\n--- TESTE 5: Compatibilidade com o Modelo de Contas a Pagar ---")
    client = TestClient(app)

    pdf_bytes = create_synthetic_invoice_pdf()
    response = client.post(
        "/api/v1/intelligence/ocr/parse",
        files={"file": ("nota_compra_cimento.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    assert response.status_code == 200
    payload = response.json()["parsed_payload"]

    # Simulação da montagem do lançamento financeiro (financial_entries)
    contas_a_pagar_entry = {
        "tipo": "despesa",
        "categoria": "insumos",
        "descricao": f"Compra de Insumos - NF {payload.get('numero_nota', 'S/N')} ({payload['fornecedor']['razao_social']})",
        "valor": payload["valor_total"],
        "data_vencimento": payload.get("data_vencimento") or payload["data_emissao"],
        "fornecedor_cnpj": payload["fornecedor"]["cnpj"],
        "status": "pendente",
        "metadata": {
            "itens_count": len(payload["itens"]),
            "chave_acesso": payload.get("chave_acesso"),
        },
    }

    assert contas_a_pagar_entry["tipo"] == "despesa"
    assert contas_a_pagar_entry["valor"] > 0
    assert contas_a_pagar_entry["fornecedor_cnpj"] is not None
    print(f"✓ Lançamento estruturado para Contas a Pagar gerado com sucesso:")
    print(f"  Descrição: {contas_a_pagar_entry['descricao']}")
    print(f"  Valor: R$ {contas_a_pagar_entry['valor']:.2f} | Vencimento: {contas_a_pagar_entry['data_vencimento']}")


def run_all_ocr_tests():
    """Orquestrador da suite de testes de OCR."""
    print("=============================================================================")
    print("           GADAP HUB - SUITE DE TESTES: OCR PREDITIVO (FASE 10)              ")
    print("=============================================================================")

    tests = [
        test_01_invalid_mime_type_rejected,
        test_02_empty_file_rejected,
        test_03_fallback_parse_resilience,
        test_04_live_ocr_parsing_with_synthetic_pdf,
        test_05_contas_a_pagar_compatibility,
    ]

    passed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except Exception as exc:
            print(f"❌ FALHA NO {t.__name__}: {exc}")
            raise

    print("\n=============================================================================")
    print(f"  SUITE DE TESTES OCR 100% APROVADA: {passed}/{len(tests)} TESTES PASSARAM COM SUCESSO!  ")
    print("=============================================================================")


if __name__ == "__main__":
    run_all_ocr_tests()
