"""
=============================================================================
GADAP Hub - Test Suite da NFS-e (Padrão Nacional)
Verificação Automatizada da Fase 9:
1. Cálculo do Módulo 11 (Chave de Acesso de 50 dígitos)
2. Regra da LC 116/2003 (Retenção do ISS para municípios distintos)
3. Geração de XML canônico e JSON
4. Carga e validação de Certificado A1 estritamente em memória
5. Geração de DANFSE (PDF) via ReportLab
6. Validação de Erros RFC 7807 (Problem Details)
7. Endpoint FastAPI POST /api/v1/fiscal/invoices/issue-nfse
=============================================================================
"""

import base64
import datetime
import io
import sys
import os
from decimal import Decimal

# Garante suporte a UTF-8 no stdout/stderr no Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

# Garante path correto
current_dir = os.path.dirname(os.path.abspath(__file__))
api_dir = os.path.abspath(os.path.join(current_dir, ".."))
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

from app.core.errors import ProblemException
from app.services.nfse_builder import NfseNationalBuilder


def generate_self_signed_pfx_in_memory(password: str = "123456") -> bytes:
    """Gera um certificado digital PKCS#12 A1 sintético em memória para testes."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "BR"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "SP"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "Campinas"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "GADAP Engenharia e Construcoes LTDA"),
        x509.NameAttribute(NameOID.COMMON_NAME, "GADAP ENGENHARIA LTDA:12345678000199"),
    ])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=365))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )

    pfx_bytes = pkcs12.serialize_key_and_certificates(
        name=b"GADAP_A1_TEST",
        key=key,
        cert=cert,
        cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(password.encode("utf-8")),
    )
    return pfx_bytes


def test_modulo11_and_access_key():
    print("▶ Testando Módulo 11 e Chave de Acesso Nacional...")
    # Testa cálculo de DV
    # 49 dígitos
    chave_49 = "3509502112345678000199000010000000000000011234567"
    dv = NfseNationalBuilder.calculate_dv_modulo11(chave_49)
    assert dv.isdigit() and len(dv) == 1, f"DV inválido: {dv}"

    # Testa geração de chave de 50 dígitos
    chave_50 = NfseNationalBuilder.generate_access_key(
        codigo_municipio_ibge="3509502",
        tipo_inscricao="1",
        documento="12345678000199",
        serie="1",
        numero_dps=1001,
        codigo_seguranca=1234567,
    )
    assert len(chave_50) == 50, f"Chave deve ter 50 dígitos, obtido: {len(chave_50)} ({chave_50})"
    assert chave_50.isdigit(), f"Chave deve conter apenas dígitos: {chave_50}"
    print(f"  ✓ Chave Nacional 50 dígitos gerada com sucesso: {chave_50}")


def test_iss_retention_rules():
    print("▶ Testando Regras Determinísticas do ISS (LC 116/2003 Art. 3º, III)...")

    # Caso A: Mesmo município (Campinas prestador, Campinas obra)
    calc_mesmo = NfseNationalBuilder.validate_and_compute_iss(
        municipio_prestador_ibge="3509502",  # Campinas
        municipio_obra_ibge="3509502",       # Campinas
        valor_servico=Decimal("10000.00"),
        valor_deducoes=Decimal("0.00"),
        aliquota_iss=Decimal("5.00"),
        iss_retido_informado=False,
    )
    assert calc_mesmo["municipios_distintos"] is False
    assert calc_mesmo["iss_retained"] is False
    assert calc_mesmo["tipo_retencao_iss"] == 2
    assert calc_mesmo["valor_iss"] == Decimal("500.00")
    assert calc_mesmo["valor_iss_retido"] == Decimal("0.00")
    print("  ✓ Mesmo município: ISS retido = False (Recolhimento pelo prestador)")

    # Caso B: Municípios distintos (Campinas prestador, São Paulo obra)
    # Art. 3º, III da LC 116/2003: O ISS pertence à obra e é RETIDO NA FONTE
    calc_distinto = NfseNationalBuilder.validate_and_compute_iss(
        municipio_prestador_ibge="3509502",  # Campinas
        municipio_obra_ibge="3550308",       # São Paulo
        valor_servico=Decimal("10000.00"),
        valor_deducoes=Decimal("0.00"),
        aliquota_iss=Decimal("5.00"),
        iss_retido_informado=False,  # Usuário não marcou, mas sistema deve forçar True!
    )
    assert calc_distinto["municipios_distintos"] is True
    assert calc_distinto["iss_retained"] is True, "ISS DEVE ser retido na fonte quando municípios diferem!"
    assert calc_distinto["tipo_retencao_iss"] == 1
    assert calc_distinto["valor_iss"] == Decimal("500.00")
    assert calc_distinto["valor_iss_retido"] == Decimal("500.00")
    assert calc_distinto["valor_inss_retido"] == Decimal("500.00")  # 5%
    # Líquido = 10000 - 500 (ISS) - 500 (INSS) = 9000
    assert calc_distinto["valor_liquido"] == Decimal("9000.00")
    print("  ✓ Municípios distintos: ISS retido forçado para True com retenção na fonte.")

    # Caso C: Validação de código IBGE inválido (RFC 7807)
    try:
        NfseNationalBuilder.validate_and_compute_iss(
            municipio_prestador_ibge="123",  # Inválido
            municipio_obra_ibge="3550308",
            valor_servico=Decimal("1000.00"),
            valor_deducoes=Decimal("0.00"),
            aliquota_iss=Decimal("5.00"),
        )
        assert False, "Deveria ter disparado ProblemException para IBGE inválido"
    except ProblemException as exc:
        assert exc.status_code == 422
        assert "Código IBGE Municipal Inválido" in exc.title
        print(f"  ✓ RFC 7807 disparado corretamente para IBGE inválido: {exc.detail}")


def test_xml_and_json_generation():
    print("▶ Testando Geração de XML canônico e JSON do Padrão Nacional...")
    calc = NfseNationalBuilder.validate_and_compute_iss(
        municipio_prestador_ibge="3509502",
        municipio_obra_ibge="3550308",
        valor_servico=Decimal("50000.00"),
        valor_deducoes=Decimal("5000.00"),
        aliquota_iss=Decimal("4.00"),
    )

    data = {
        "access_key": "35095021123456780001990000100000000000000112345678",
        "numero_nfse": 1050,
        "numero_dps": 1050,
        "serie": "1",
        "protocol_number": "PROT-20261025-998877",
        "authorized_at": "25/10/2026 10:30:00",
        "environment": "homologacao",
        "discriminacao_servicos": "Execução de fundações profundas e estacas hélice contínua conforme ART 123456.",
        "codigo_tributacao_nacional": "070201",
        "codigo_tributacao_lc116": "07.02",
        "prestador": {
            "cnpj": "12345678000199",
            "razao_social": "GADAP Engenharia LTDA",
            "inscricao_municipal": "123456",
            "codigo_municipio_ibge": "3509502",
            "uf": "SP",
            "optante_simples_nacional": False,
        },
        "tomador": {
            "documento": "98765432000188",
            "nome": "Incorporadora Alpha SPE",
            "email": "fiscal@alpha.com.br",
            "telefone": "11988887777",
            "endereco_logradouro": "Av. Paulista",
            "endereco_numero": "1000",
            "endereco_bairro": "Bela Vista",
            "endereco_municipio_ibge": "3550308",
            "endereco_uf": "SP",
            "endereco_cep": "01310100",
        },
        "obra": {
            "cno": "12.345.67890/11",
            "art": "SP202600112233",
            "municipio_obra_nome": "São Paulo",
        },
        "calculo_iss": calc,
    }

    # XML
    xml_str = NfseNationalBuilder.build_nfse_xml(data)
    assert 'xmlns="http://www.sped.fazenda.gov.br/nfse"' in xml_str
    assert "<cLocPrestacao>3550308</cLocPrestacao>" in xml_str
    assert "<tpRetISSQN>1</tpRetISSQN>" in xml_str
    assert "<cno>12.345.67890/11</cno>" in xml_str
    print("  ✓ XML canônico da DPS gerado em conformidade com o Sped Nacional.")

    # JSON
    json_obj = NfseNationalBuilder.build_nfse_json(data)
    assert json_obj["infDPS"]["nDPS"] == 1050
    assert json_obj["infDPS"]["valores"]["issRetido"] is True
    print("  ✓ Payload JSON gerado conforme especificação da API Nacional.")

    # PDF DANFSE
    pdf_bytes = NfseNationalBuilder.generate_danfse_pdf(data)
    assert pdf_bytes.startswith(b"%PDF"), "O arquivo gerado deve ser um PDF válido"
    assert len(pdf_bytes) > 2000, f"PDF gerado possui tamanho suspeito: {len(pdf_bytes)} bytes"
    print(f"  ✓ DANFSE (PDF) compilado com sucesso ({len(pdf_bytes)} bytes).")


def test_a1_certificate_in_memory():
    print("▶ Testando Descriptografia de Certificado A1 estritamente em memória...")
    pfx_bytes = generate_self_signed_pfx_in_memory(password="MinhaSenhaForte2026")

    # Leitura com senha correta
    cert_info = NfseNationalBuilder.load_a1_certificate_in_memory(pfx_bytes, "MinhaSenhaForte2026")
    assert cert_info["valid"] is True
    assert cert_info["has_private_key"] is True
    assert "GADAP ENGENHARIA LTDA" in cert_info["common_name"]
    print("  ✓ Certificado A1 descriptografado em memória e validado.")

    # Teste de falha de senha (RFC 7807)
    try:
        NfseNationalBuilder.load_a1_certificate_in_memory(pfx_bytes, "SenhaIncorreta")
        assert False, "Deveria ter falhado ao informar senha incorreta"
    except ProblemException as exc:
        assert exc.status_code == 422
        assert "Erro de Leitura do Certificado A1" in exc.title
        print(f"  ✓ RFC 7807 disparado para senha incorreta de A1: {exc.title}")


def test_fastapi_endpoint():
    print("▶ Testando Endpoint FastAPI POST /api/v1/fiscal/invoices/issue-nfse...")
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.deps import get_current_tenant_and_token
    from app.core.config import settings
    from uuid import UUID, uuid4
    import httpx

    # Tenta obter o tenant_id real da Empresa Teste no Supabase
    real_tenant_id = uuid4()
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        try:
            h = {"apikey": settings.SUPABASE_SERVICE_ROLE_KEY, "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"}
            r = httpx.get(f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/companies?select=id&limit=1", headers=h, timeout=5.0)
            if r.status_code == 200 and r.json():
                real_tenant_id = UUID(r.json()[0]["id"])
        except Exception:
            pass

    mock_token = settings.SUPABASE_SERVICE_ROLE_KEY or "mock-bearer-token"

    # Override de dependência para autenticação com o tenant real
    app.dependency_overrides[get_current_tenant_and_token] = lambda: (real_tenant_id, mock_token)

    client = TestClient(app)

    # 1. Teste de erro 422: Prestador presente mas falta dados do tomador e client_id
    resp_invalid = client.post(
        "/api/v1/fiscal/invoices/issue-nfse",
        json={
            "discriminacao_servicos": "Serviços de concretagem e armação de ferragens",
            "prestador": {
                "cnpj": "12345678000199",
                "razao_social": "GADAP Engenharia e Construções LTDA",
                "codigo_municipio_ibge": "3509502",
                "uf": "SP",
            },
            "valores": {
                "valor_servicos": 15000.00,
                "aliquota_iss": 5.00,
            },
        },
    )
    assert resp_invalid.status_code == 422, f"Esperado 422, recebido: {resp_invalid.status_code} - {resp_invalid.text}"
    assert resp_invalid.headers.get("content-type") == "application/problem+json"
    data_err = resp_invalid.json()
    assert data_err.get("type") == "https://gadap.com.br/errors/missing-taker-data"
    print(f"  ✓ Endpoint respondeu RFC 7807 (422): {data_err['title']} - {data_err['detail']}")

    # 2. Teste de emissão completa com prestador e tomador informados (simulação)
    resp_success = client.post(
        "/api/v1/fiscal/invoices/issue-nfse",
        json={
            "discriminacao_servicos": "Execução de estacas e fundações civis",
            "prestador": {
                "cnpj": "12345678000199",
                "razao_social": "GADAP Engenharia e Construções LTDA",
                "codigo_municipio_ibge": "3509502",  # Campinas
                "uf": "SP",
                "optante_simples_nacional": True,
            },
            "tomador": {
                "documento": "98765432000188",
                "nome": "Empreendimentos Imobiliários Beta LTDA",
                "endereco_municipio_ibge": "3550308",  # São Paulo
                "endereco_uf": "SP",
            },
            "obra": {
                "cno": "12.345.67890/22",
                "art": "ART-2026-99",
                "municipio_obra_ibge": "3550308",  # São Paulo (distinto de Campinas)
                "municipio_obra_nome": "São Paulo",
            },
            "valores": {
                "valor_servicos": 25000.00,
                "aliquota_iss": 5.00,
            },
            "whatsapp_notification": False,  # Desliga WA para teste de unidade
        },
    )
    assert resp_success.status_code == 201, f"Falha na emissão: {resp_success.status_code} - {resp_success.text}"
    body = resp_success.json()
    assert body["success"] is True
    assert body["status"] == "autorizada"
    assert len(body["access_key"]) == 50
    assert body["iss_retained"] is True  # Forçado porque 3509502 != 3550308
    assert float(body["iss_amount"]) == 1250.00
    assert float(body["iss_retained_amount"]) == 1250.00
    assert float(body["net_amount"]) == 22500.00  # 25000 - 1250 (ISS) - 1250 (INSS 5%)
    assert "xml-fiscais" in body["xml_url"]
    assert "xml-fiscais" in body["pdf_url"]
    print(f"  ✓ Endpoint emitiu NFS-e Nacional com sucesso! Chave: {body['access_key']}")
    print(f"  ✓ Retenção ISS validada: R$ {float(body['iss_retained_amount']):.2f} (Retido na fonte)")
    print(f"  ✓ Valor Líquido validado: R$ {float(body['net_amount']):.2f}")

    # Limpa override
    app.dependency_overrides.clear()


def run_all_tests():
    print("================================================================")
    print(" INICIANDO BATERIA DE TESTES: MOTOR FISCAL NFS-e (FASE 9)       ")
    print("================================================================")
    test_modulo11_and_access_key()
    test_iss_retention_rules()
    test_xml_and_json_generation()
    test_a1_certificate_in_memory()
    test_fastapi_endpoint()
    print("================================================================")
    print(" ✅ TODOS OS TESTES PASSARAM COM SUCESSO!                       ")
    print("================================================================")


if __name__ == "__main__":
    run_all_tests()
