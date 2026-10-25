"""
=============================================================================
GADAP Hub - Gerador da NFS-e (Padrão Nacional da Receita Federal)
Módulo: app/services/nfse_builder.py
=============================================================================
Responsável por:
1. Geração de XML canônico da DPS (Declaração de Prestação de Serviços) conforme
   Manual Técnico do Sistema Nacional da NFS-e (Receita Federal / CGNFS-e).
2. Geração do payload JSON do Padrão Nacional.
3. Validação matemática determinística da competência e retenção do ISS (LC 116/2003, Art. 3º, III).
4. Cálculo do Módulo 11 para Chave de Acesso Nacional de 50 dígitos.
5. Descriptografia estritamente em memória de Certificados Digitais A1 (PKCS#12).
6. Geração do Documento Auxiliar da NFS-e (DANFSE) em PDF utilizando ReportLab.
=============================================================================
"""

import datetime
import io
import logging
import random
import re
from decimal import Decimal, ROUND_HALF_EVEN
from typing import Any, Dict, List, Optional, Tuple
from xml.etree import ElementTree as ET

from cryptography import x509
from cryptography.hazmat.primitives.serialization import pkcs12
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

try:
    from app.core.errors import ProblemException
except ImportError:
    try:
        from api.app.core.errors import ProblemException
    except ImportError:
        class ProblemException(Exception):  # type: ignore
            def __init__(self, status_code: int = 400, title: str = "Erro Fiscal", detail: str = "", type_uri: str = "", **kwargs: Any) -> None:
                self.status_code = status_code
                self.title = title
                self.detail = detail
                self.type_uri = type_uri
                super().__init__(detail)

logger = logging.getLogger("gadap.nfse")


class NfseNationalBuilder:
    """
    Construtor e orquestrador determinístico do Padrão Nacional da NFS-e.
    Em conformidade com a Lei Complementar 116/2003 e Instruções Normativas da RFB.
    """

    @staticmethod
    def calculate_dv_modulo11(chave_49_digitos: str) -> str:
        """
        Calcula o dígito verificador (DV) da chave de acesso através do algoritmo Módulo 11
        com pesos cíclicos de 2 a 9 (padrão oficial SEFAZ / SPED / NFS-e Nacional).
        """
        if len(chave_49_digitos) != 49 or not chave_49_digitos.isdigit():
            raise ValueError(f"Chave para cálculo do DV deve possuir exatamente 49 dígitos numéricos: {chave_49_digitos}")

        pesos = [2, 3, 4, 5, 6, 7, 8, 9]
        soma = 0
        peso_idx = 0

        for char in reversed(chave_49_digitos):
            soma += int(char) * pesos[peso_idx]
            peso_idx = (peso_idx + 1) % len(pesos)

        resto = soma % 11
        dv = 11 - resto
        if dv in (0, 10, 11):
            return "0"
        return str(dv)

    @classmethod
    def generate_access_key(
        cls,
        codigo_municipio_ibge: str,
        tipo_inscricao: str,  # '1' para CNPJ ou '2' para CPF
        documento: str,
        serie: str,
        numero_dps: int,
        codigo_seguranca: Optional[int] = None,
    ) -> str:
        """
        Gera a Chave de Acesso canônica de 50 dígitos da NFS-e Nacional:
        - Código IBGE do Município Emissor (7 dígitos)
        - Tipo de Inscrição Federal (1 dígito: 1=CNPJ, 2=CPF)
        - Documento do Emissor (14 dígitos, preenchido com zeros à esquerda)
        - Série da DPS (5 dígitos)
        - Número da DPS (15 dígitos)
        - Código Numérico de Segurança (7 dígitos)
        - Dígito Verificador Módulo 11 (1 dígito)
        Total: 50 dígitos.
        """
        c_mun = str(codigo_municipio_ibge).zfill(7)[:7]
        tp_insc = "1" if tipo_inscricao in ("1", "CNPJ", "cnpj") else "2"
        doc = "".join(filter(str.isdigit, str(documento))).zfill(14)[:14]
        ser = "".join(filter(str.isdigit, str(serie))).zfill(5)[:5]
        n_dps = str(numero_dps).zfill(15)[:15]
        c_seg = str(codigo_seguranca or random.randint(1000000, 9999999)).zfill(7)[:7]

        chave_base = f"{c_mun}{tp_insc}{doc}{ser}{n_dps}{c_seg}"
        dv = cls.calculate_dv_modulo11(chave_base)
        return f"{chave_base}{dv}"

    @staticmethod
    def validate_and_compute_iss(
        municipio_prestador_ibge: str,
        municipio_obra_ibge: str,
        valor_servico: Decimal,
        valor_deducoes: Decimal,
        aliquota_iss: Decimal,
        iss_retido_informado: Optional[bool] = None,
        aliquota_inss: Decimal = Decimal("5.00"),
        aliquota_irrf: Decimal = Decimal("0.00"),
        aliquota_csll: Decimal = Decimal("0.00"),
        aliquota_pis: Decimal = Decimal("0.00"),
        aliquota_cofins: Decimal = Decimal("0.00"),
    ) -> Dict[str, Any]:
        """
        Aplica as regras determinísticas do Art. 3º, inciso III da Lei Complementar nº 116/2003:
        Para serviços de engenharia civil e reformas (itens 7.02 e 7.05 da Lista de Serviços):
        - Se município prestador != município obra: O ISSQN pertence ao município da obra e
          é OBRIGATORIAMENTE RETIDO na fonte pelo tomador.
        - Se município prestador == município obra: O ISS pertence ao município sede.
        """
        c_prestador = "".join(filter(str.isdigit, str(municipio_prestador_ibge)))
        c_obra = "".join(filter(str.isdigit, str(municipio_obra_ibge)))

        if len(c_prestador) != 7 or len(c_obra) != 7:
            raise ProblemException(
                status_code=422,
                title="Código IBGE Municipal Inválido",
                detail=f"Os códigos IBGE do prestador ({c_prestador}) e da obra ({c_obra}) devem possuir exatamente 7 dígitos.",
                type_uri="https://gadap.com.br/errors/invalid-ibge-code",
            )

        # Regra de Competência Territorial da Construção Civil
        municipios_distintos = c_prestador != c_obra
        iss_retained = True if municipios_distintos else bool(iss_retido_informado)

        # Alerta se usuário tentou forçar iss_retido=False em municípios distintos
        if municipios_distintos and iss_retido_informado is False:
            logger.warning(
                "Inconsistência Fiscal Corrigida: Município prestador (%s) != Município obra (%s). "
                "Retenção de ISS forçada para True conforme Art. 3º, III da LC 116/2003.",
                c_prestador,
                c_obra,
            )

        # Arredondamento Bancário (Half to Even) em 2 casas decimais
        base_calculo = max(valor_servico - valor_deducoes, Decimal("0.00")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_EVEN
        )
        valor_iss = (base_calculo * (aliquota_iss / Decimal("100.00"))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_EVEN
        )
        valor_iss_retido = valor_iss if iss_retained else Decimal("0.00")

        # Retenção Técnica / Previdenciária INSS (IN RFB 2.110/2022)
        valor_inss_retido = (valor_servico * (aliquota_inss / Decimal("100.00"))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_EVEN
        )

        # Tributos Federais Retidos (IRRF, CSLL, PIS, COFINS)
        valor_irrf = (valor_servico * (aliquota_irrf / Decimal("100.00"))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_EVEN
        )
        valor_csll = (valor_servico * (aliquota_csll / Decimal("100.00"))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_EVEN
        )
        valor_pis = (valor_servico * (aliquota_pis / Decimal("100.00"))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_EVEN
        )
        valor_cofins = (valor_servico * (aliquota_cofins / Decimal("100.00"))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_EVEN
        )

        total_retencoes = (
            valor_iss_retido + valor_inss_retido + valor_irrf + valor_csll + valor_pis + valor_cofins
        )
        valor_liquido = max(valor_servico - total_retencoes, Decimal("0.00")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_EVEN
        )

        return {
            "municipio_prestador_ibge": c_prestador,
            "municipio_obra_ibge": c_obra,
            "municipios_distintos": municipios_distintos,
            "iss_retained": iss_retained,
            "tipo_retencao_iss": 1 if iss_retained else 2,  # 1=Retido na Fonte, 2=Não Retido
            "valor_servicos": valor_servico.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN),
            "valor_deducoes": valor_deducoes.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN),
            "base_calculo": base_calculo,
            "aliquota_iss": aliquota_iss.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN),
            "valor_iss": valor_iss,
            "valor_iss_retido": valor_iss_retido,
            "aliquota_inss": aliquota_inss.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN),
            "valor_inss_retido": valor_inss_retido,
            "valor_irrf_retido": valor_irrf,
            "valor_csll_retido": valor_csll,
            "valor_pis": valor_pis,
            "valor_cofins": valor_cofins,
            "total_retencoes": total_retencoes,
            "valor_liquido": valor_liquido,
        }

    @classmethod
    def build_nfse_xml(cls, data: Dict[str, Any]) -> str:
        """
        Gera a string XML da DPS conforme o esquema canônico do Padrão Nacional da NFS-e.
        """
        dps_id = f"DPS{data['access_key']}"
        now_iso = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        competencia = data.get("competencia") or datetime.date.today().strftime("%Y-%m-%d")

        xml_lines: List[str] = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            f'<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">',
            f'  <infDPS Id="{dps_id}">',
            f"    <tpAmb>{'1' if data.get('environment') == 'producao' else '2'}</tpAmb>",
            f"    <dhEmi>{now_iso}</dhEmi>",
            f"    <verAplic>GADAP-ERP-1.0</verAplic>",
            f"    <serie>{str(data.get('serie', '1')).zfill(5)}</serie>",
            f"    <nDPS>{int(data['numero_dps'])}</nDPS>",
            f"    <dCompet>{competencia}</dCompet>",
            f"    <tpEmit>1</tpEmit>",  # 1 = Prestador
            f"    <cLocEmi>{data['prestador']['codigo_municipio_ibge']}</cLocEmi>",
            # Prestador
            f"    <prest>",
            f"      <CNPJ>{data['prestador']['cnpj']}</CNPJ>",
            f"      <xNome>{cls._escape_xml(data['prestador']['razao_social'])}</xNome>",
        ]

        if data["prestador"].get("inscricao_municipal"):
            xml_lines.append(f"      <IM>{data['prestador']['inscricao_municipal']}</IM>")

        xml_lines.extend([
            f"      <regTrib>",
            f"        <opSimpNac>{'1' if data['prestador'].get('optante_simples_nacional') else '2'}</opSimpNac>",
            f"        <regEspTrib>{data['prestador'].get('regime_especial_tributacao', 0)}</regEspTrib>",
            f"      </regTrib>",
            f"    </prest>",
            # Tomador
            f"    <toma>",
        ])

        doc_toma = data["tomador"]["documento"]
        if len(doc_toma) == 11:
            xml_lines.append(f"      <CPF>{doc_toma}</CPF>")
        else:
            xml_lines.append(f"      <CNPJ>{doc_toma}</CNPJ>")

        xml_lines.append(f"      <xNome>{cls._escape_xml(data['tomador']['nome'])}</xNome>")

        if data["tomador"].get("inscricao_municipal"):
            xml_lines.append(f"      <IM>{data['tomador']['inscricao_municipal']}</IM>")

        cep_val = "".join(filter(str.isdigit, str(data["tomador"].get("endereco_cep") or "00000000"))).zfill(8)
        xml_lines.extend([
            f"      <end>",
            f"        <xLgr>{cls._escape_xml(data['tomador'].get('endereco_logradouro') or 'Nao Informado')}</xLgr>",
            f"        <nro>{cls._escape_xml(data['tomador'].get('endereco_numero') or 'S/N')}</nro>",
            f"        <xBairro>{cls._escape_xml(data['tomador'].get('endereco_bairro') or 'Centro')}</xBairro>",
            f"        <cMun>{data['tomador'].get('endereco_municipio_ibge') or data['prestador']['codigo_municipio_ibge']}</cMun>",
            f"        <UF>{data['tomador'].get('endereco_uf') or data['prestador']['uf']}</UF>",
            f"        <CEP>{cep_val}</CEP>",
            f"      </end>",
        ])

        if data["tomador"].get("telefone"):
            fone_val = "".join(filter(str.isdigit, str(data["tomador"].get("telefone") or "")))
            if fone_val:
                xml_lines.append(f"      <fone>{fone_val}</fone>")
        if data["tomador"].get("email"):
            xml_lines.append(f"      <email>{cls._escape_xml(data['tomador']['email'])}</email>")

        xml_lines.extend([
            f"    </toma>",
            # Serviços
            f"    <serv>",
            f"      <locPrest>",
            f"        <cLocPrestacao>{data['calculo_iss']['municipio_obra_ibge']}</cLocPrestacao>",
            f"      </locPrest>",
            f"      <cServ>",
            f"        <cTribNac>{data.get('codigo_tributacao_nacional', '070201')}</cTribNac>",
            f"        <cTribMun>{data.get('codigo_tributacao_lc116', '07.02')}</cTribMun>",
            f"        <xDescServ>{cls._escape_xml(data['discriminacao_servicos'])}</xDescServ>",
            f"      </cServ>",
            f"    </serv>",
            # Valores e Tributos
            f"    <valores>",
            f"      <vServPrest>{data['calculo_iss']['valor_servicos']:.2f}</vServPrest>",
            f"      <vDescIncond>0.00</vDescIncond>",
            f"      <vDed>{data['calculo_iss']['valor_deducoes']:.2f}</vDed>",
            f"      <trib>",
            f"        <tribMun>",
            f"          <tribISSQN>1</tribISSQN>",
            f"          <cLocIncid>{data['calculo_iss']['municipio_obra_ibge']}</cLocIncid>",
            f"          <vBC>{data['calculo_iss']['base_calculo']:.2f}</vBC>",
            f"          <pAliq>{data['calculo_iss']['aliquota_iss']:.2f}</pAliq>",
            f"          <vISSQN>{data['calculo_iss']['valor_iss']:.2f}</vISSQN>",
            f"          <tpRetISSQN>{data['calculo_iss']['tipo_retencao_iss']}</tpRetISSQN>",
            f"          <vISSRet>{data['calculo_iss']['valor_iss_retido']:.2f}</vISSRet>",
            f"        </tribMun>",
            f"        <tribFed>",
            f"          <vRetCP>{data['calculo_iss']['valor_inss_retido']:.2f}</vRetCP>",
            f"          <vRetIRRF>{data['calculo_iss']['valor_irrf_retido']:.2f}</vRetIRRF>",
            f"          <vRetCSLL>{data['calculo_iss']['valor_csll_retido']:.2f}</vRetCSLL>",
            f"        </tribFed>",
            f"      </trib>",
            f"      <vLiq>{data['calculo_iss']['valor_liquido']:.2f}</vLiq>",
            f"    </valores>",
        ])

        # Obra / Construção Civil
        if data.get("obra"):
            xml_lines.extend([
                f"    <construcaoCivil>",
                f"      <cMunObra>{data['calculo_iss']['municipio_obra_ibge']}</cMunObra>",
            ])
            if data["obra"].get("cno"):
                xml_lines.append(f"      <cno>{cls._escape_xml(data['obra']['cno'])}</cno>")
            if data["obra"].get("art"):
                xml_lines.append(f"      <art>{cls._escape_xml(data['obra']['art'])}</art>")
            xml_lines.append(f"    </construcaoCivil>")

        xml_lines.extend([
            f"  </infDPS>",
            f"</DPS>",
        ])

        return "\n".join(xml_lines)

    @classmethod
    def build_nfse_json(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Gera o payload em dicionário/JSON conforme API REST do Padrão Nacional da NFS-e.
        """
        calc = data["calculo_iss"]
        return {
            "infDPS": {
                "id": f"DPS{data['access_key']}",
                "tpAmb": 1 if data.get("environment") == "producao" else 2,
                "dhEmi": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "verAplic": "GADAP-ERP-1.0",
                "serie": str(data.get("serie", "1")),
                "nDPS": int(data["numero_dps"]),
                "dCompet": data.get("competencia") or datetime.date.today().isoformat(),
                "cLocEmi": data["prestador"]["codigo_municipio_ibge"],
                "prest": {
                    "CNPJ": data["prestador"]["cnpj"],
                    "xNome": data["prestador"]["razao_social"],
                    "IM": data["prestador"].get("inscricao_municipal"),
                    "optanteSimplesNacional": data["prestador"].get("optante_simples_nacional", True),
                },
                "toma": {
                    "documento": data["tomador"]["documento"],
                    "xNome": data["tomador"]["nome"],
                    "email": data["tomador"].get("email"),
                    "fone": data["tomador"].get("telefone"),
                    "cMun": data["tomador"].get("endereco_municipio_ibge"),
                },
                "serv": {
                    "cLocPrestacao": calc["municipio_obra_ibge"],
                    "cTribNac": data.get("codigo_tributacao_nacional", "070201"),
                    "cTribMun": data.get("codigo_tributacao_lc116", "07.02"),
                    "xDescServ": data["discriminacao_servicos"],
                },
                "valores": {
                    "vServPrest": float(calc["valor_servicos"]),
                    "vBC": float(calc["base_calculo"]),
                    "pAliq": float(calc["aliquota_iss"]),
                    "vISS": float(calc["valor_iss"]),
                    "issRetido": calc["iss_retained"],
                    "vISSRet": float(calc["valor_iss_retido"]),
                    "vINSSRet": float(calc["valor_inss_retido"]),
                    "vLiq": float(calc["valor_liquido"]),
                },
                "construcaoCivil": {
                    "cno": data.get("obra", {}).get("cno"),
                    "art": data.get("obra", {}).get("art"),
                    "cMunObra": calc["municipio_obra_ibge"],
                },
            }
        }

    @staticmethod
    def load_a1_certificate_in_memory(
        pfx_bytes: bytes,
        password: str,
    ) -> Dict[str, Any]:
        """
        Carrega e descriptografa o Certificado Digital ICP-Brasil A1 (PKCS#12) estritamente em memória.
        Nenhum arquivo de chave privada é salvo em disco.
        """
        try:
            pwd_bytes = password.encode("utf-8") if isinstance(password, str) else password
            private_key, certificate, additional_certs = pkcs12.load_key_and_certificates(
                pfx_bytes, pwd_bytes
            )

            if not certificate:
                raise ProblemException(
                    status_code=422,
                    title="Certificado A1 Inválido",
                    detail="O arquivo PKCS#12 fornecido não contém um certificado X.509 válido.",
                    type_uri="https://gadap.com.br/errors/invalid-certificate",
                )

            # Valida vigência temporal do certificado
            now = datetime.datetime.now(datetime.timezone.utc)
            not_before = certificate.not_valid_before_utc
            not_after = certificate.not_valid_after_utc

            if now < not_before or now > not_after:
                raise ProblemException(
                    status_code=422,
                    title="Certificado A1 Expirado ou Fora de Vigência",
                    detail=f"Certificado digital expirou em {not_after.strftime('%d/%m/%Y %H:%M:%S')} (Horário atual: {now.strftime('%d/%m/%Y')}).",
                    type_uri="https://gadap.com.br/errors/expired-certificate",
                )

            # Extração de Metadados
            subject_dict = {attr.oid._name: attr.value for attr in certificate.subject}
            cn = subject_dict.get("commonName", "Certificado A1")

            return {
                "valid": True,
                "common_name": cn,
                "serial_number": hex(certificate.serial_number),
                "not_before": not_before.isoformat(),
                "not_after": not_after.isoformat(),
                "has_private_key": private_key is not None,
                "subject": subject_dict,
                # Mantém referências aos objetos em memória para o handshake mTLS
                "_private_key_obj": private_key,
                "_cert_obj": certificate,
            }

        except ProblemException:
            raise
        except Exception as exc:
            logger.error("Falha ao descriptografar certificado A1 em memória: %s", str(exc))
            raise ProblemException(
                status_code=422,
                title="Erro de Leitura do Certificado A1",
                detail=f"Não foi possível abrir o certificado A1 em memória. Verifique a senha informada. Detalhe: {str(exc)}",
                type_uri="https://gadap.com.br/errors/certificate-decrypt-error",
            ) from exc

    @classmethod
    def generate_danfse_pdf(cls, data: Dict[str, Any]) -> bytes:
        """
        Gera o PDF oficial do Documento Auxiliar da NFS-e (DANFSE) em memória utilizando ReportLab.
        Retorna os bytes do PDF pronto para armazenamento e transmissão.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        calc = data["calculo_iss"]
        prest = data["prestador"]
        toma = data["tomador"]
        obra = data.get("obra") or {}

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Heading1"],
            fontSize=12,
            leading=14,
            textColor=HexColor("#0f172a"),
            alignment=1,
            fontName="Helvetica-Bold",
        )
        subtitle_style = ParagraphStyle(
            "DocSubtitle",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            textColor=HexColor("#475569"),
            alignment=1,
            fontName="Helvetica",
        )
        section_style = ParagraphStyle(
            "SectionHeader",
            parent=styles["Normal"],
            fontSize=9,
            leading=11,
            textColor=HexColor("#0f172a"),
            fontName="Helvetica-Bold",
        )
        cell_style = ParagraphStyle(
            "CellNormal",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            textColor=HexColor("#1e293b"),
            fontName="Helvetica",
        )
        cell_bold = ParagraphStyle(
            "CellBold",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            textColor=HexColor("#0f172a"),
            fontName="Helvetica-Bold",
        )
        alert_style = ParagraphStyle(
            "AlertCell",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            textColor=HexColor("#b91c1c"),
            fontName="Helvetica-Bold",
        )

        story: List[Any] = []

        # 1. Cabeçalho Nacional
        header_text = [
            Paragraph("SISTEMA NACIONAL DA NOTA FISCAL DE SERVIÇO ELETRÔNICA", title_style),
            Paragraph("DANFSE - Documento Auxiliar da NFS-e (Padrão Nacional)", subtitle_style),
            Spacer(1, 8),
        ]
        story.extend(header_text)

        # 2. Caixa de Dados Gerais e Chave de Acesso
        chave_formatada = " ".join([data["access_key"][i : i + 4] for i in range(0, len(data["access_key"]), 4)])
        gerais_data = [
            [
                Paragraph("<b>NÚMERO DA NFS-e</b>", cell_style),
                Paragraph("<b>DATA/HORA EMISSÃO</b>", cell_style),
                Paragraph("<b>NÚMERO DA DPS</b>", cell_style),
                Paragraph("<b>PROTOCOLO DE AUTORIZAÇÃO</b>", cell_style),
            ],
            [
                Paragraph(str(data["numero_nfse"]), cell_bold),
                Paragraph(data["authorized_at"], cell_style),
                Paragraph(f"{data['numero_dps']} (Série {data.get('serie', '1')})", cell_style),
                Paragraph(data["protocol_number"], cell_style),
            ],
            [
                Paragraph("<b>CHAVE DE ACESSO NACIONAL (50 DÍGITOS)</b>", cell_style),
                Paragraph(chave_formatada, cell_bold),
                "",
                "",
            ],
        ]
        t_gerais = Table(gerais_data, colWidths=[130, 130, 130, 130])
        t_gerais.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 1, HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#e2e8f0")),
                ("SPAN", (1, 2), (3, 2)),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        story.append(t_gerais)
        story.append(Spacer(1, 8))

        # 3. Prestador e Tomador
        prestador_doc = f"CNPJ: {prest['cnpj']}"
        prestador_lines = (
            f"<b>{prest['razao_social']}</b><br/>"
            f"{prestador_doc} | IM: {prest.get('inscricao_municipal', 'Isento')}<br/>"
            f"Município Sede: {prest['codigo_municipio_ibge']} - {prest.get('uf', 'SP')}<br/>"
            f"Regime: {'Simples Nacional' if prest.get('optante_simples_nacional') else 'Regime Normal'}"
        )

        tomador_doc = f"Doc: {toma['documento']}"
        tomador_lines = (
            f"<b>{toma['nome']}</b><br/>"
            f"{tomador_doc} | IM: {toma.get('inscricao_municipal', 'N/I')}<br/>"
            f"Endereço: {toma.get('endereco_logradouro', 'N/I')}, {toma.get('endereco_numero', 'S/N')} - {toma.get('endereco_bairro', 'Centro')}<br/>"
            f"E-mail: {toma.get('email', 'N/I')} | Fone: {toma.get('telefone', 'N/I')}"
        )

        partes_data = [
            [Paragraph("PRESTADOR DE SERVIÇOS", section_style), Paragraph("TOMADOR DE SERVIÇOS", section_style)],
            [Paragraph(prestador_lines, cell_style), Paragraph(tomador_lines, cell_style)],
        ]
        t_partes = Table(partes_data, colWidths=[260, 260])
        t_partes.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), HexColor("#f1f5f9")),
                ("BOX", (0, 0), (-1, -1), 1, HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        story.append(t_partes)
        story.append(Spacer(1, 8))

        # 4. Dados da Obra de Construção Civil
        cno_str = obra.get("cno") or "Não Informado"
        art_str = obra.get("art") or "Não Informado"
        obra_mun = f"IBGE: {calc['municipio_obra_ibge']}"
        if obra.get("municipio_obra_nome"):
            obra_mun += f" ({obra['municipio_obra_nome']})"

        obra_info = (
            f"<b>CNO (Cadastro Nacional de Obras):</b> {cno_str} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>ART/RRT:</b> {art_str} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>Local de Execução (Canteiro):</b> {obra_mun}"
        )
        obra_data = [
            [Paragraph("DADOS DA OBRA / SERVIÇO CIVIL (SUBITENS 7.02 / 7.05 LC 116/2003)", section_style)],
            [Paragraph(obra_info, cell_style)],
        ]
        t_obra = Table(obra_data, colWidths=[520])
        t_obra.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), HexColor("#f1f5f9")),
                ("BOX", (0, 0), (-1, -1), 1, HexColor("#cbd5e1")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        story.append(t_obra)
        story.append(Spacer(1, 8))

        # 5. Discriminação dos Serviços
        servicos_data = [
            [Paragraph("DISCRIMINAÇÃO DOS SERVIÇOS EXECUTADOS", section_style)],
            [Paragraph(cls._escape_xml(data["discriminacao_servicos"]), cell_style)],
        ]
        t_servicos = Table(servicos_data, colWidths=[520])
        t_servicos.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), HexColor("#f1f5f9")),
                ("BOX", (0, 0), (-1, -1), 1, HexColor("#cbd5e1")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ])
        )
        story.append(t_servicos)
        story.append(Spacer(1, 8))

        # 6. Demonstrativo Tributário e Valores
        iss_status = "SIM (RETIDO NA FONTE PELO TOMADOR)" if calc["iss_retained"] else "NÃO (DEVIDO PELO PRESTADOR)"
        tributos_data = [
            [
                Paragraph("<b>VALOR SERVIÇOS</b>", cell_style),
                Paragraph("<b>DEDUÇÕES BASE</b>", cell_style),
                Paragraph("<b>BASE CÁLCULO ISS</b>", cell_style),
                Paragraph("<b>ALÍQUOTA ISS</b>", cell_style),
                Paragraph("<b>VALOR ISS</b>", cell_style),
            ],
            [
                Paragraph(f"R$ {calc['valor_servicos']:,.2f}", cell_bold),
                Paragraph(f"R$ {calc['valor_deducoes']:,.2f}", cell_style),
                Paragraph(f"R$ {calc['base_calculo']:,.2f}", cell_bold),
                Paragraph(f"{calc['aliquota_iss']:.2f}%", cell_style),
                Paragraph(f"R$ {calc['valor_iss']:,.2f}", cell_bold),
            ],
            [
                Paragraph("<b>RETENÇÃO ISS?</b>", cell_style),
                Paragraph(iss_status, alert_style if calc["iss_retained"] else cell_style),
                "",
                Paragraph("<b>RET. INSS (5%/11%)</b>", cell_style),
                Paragraph(f"R$ {calc['valor_inss_retido']:,.2f}", cell_style),
            ],
            [
                Paragraph("<b>VALOR LÍQUIDO A RECEBER</b>", section_style),
                Paragraph(f"R$ {calc['valor_liquido']:,.2f}", title_style),
                "",
                "",
                "",
            ],
        ]
        t_trib = Table(tributos_data, colWidths=[104, 104, 104, 104, 104])
        t_trib.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), HexColor("#f1f5f9")),
                ("BACKGROUND", (0, 3), (-1, 3), HexColor("#fef2f2" if calc["iss_retained"] else "#f0fdf4")),
                ("BOX", (0, 0), (-1, -1), 1, HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#e2e8f0")),
                ("SPAN", (1, 2), (2, 2)),
                ("SPAN", (1, 3), (4, 3)),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        story.append(t_trib)
        story.append(Spacer(1, 10))

        # 7. Rodapé de Auditoria e Conformidade
        rodape_text = (
            "<i>Documento gerado automaticamente pelo motor fiscal determinístico GADAP Hub.<br/>"
            "Conformidade: LC 116/2003, Art. 3º, III • IN RFB 2.110/2022 • Sistema Nacional da NFS-e.</i>"
        )
        story.append(Paragraph(rodape_text, subtitle_style))

        # Compilação do PDF
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    @staticmethod
    def _escape_xml(text: Any) -> str:
        """Sanitiza strings para inserção em XML."""
        if text is None:
            return ""
        s = str(text)
        s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        s = s.replace('"', "&quot;").replace("'", "&apos;")
        return s
