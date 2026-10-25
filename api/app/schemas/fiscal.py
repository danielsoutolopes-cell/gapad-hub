"""
=============================================================================
GADAP Hub - Schemas de Dados Fiscais e NFS-e Padrão Nacional
Tipagem estrita e validação com Pydantic v2
=============================================================================
"""

from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class PrestadorFiscalSchema(BaseModel):
    cnpj: str = Field(..., description="CNPJ do Prestador (14 dígitos sem formatação)")
    razao_social: str = Field(..., min_length=2, max_length=255)
    nome_fantasia: Optional[str] = None
    inscricao_municipal: Optional[str] = None
    codigo_municipio_ibge: str = Field(..., min_length=7, max_length=7, description="Código IBGE 7 dígitos do prestador")
    uf: str = Field(..., min_length=2, max_length=2)
    optante_simples_nacional: bool = True
    regime_especial_tributacao: Optional[int] = 0

    @field_validator("cnpj", mode="before")
    @classmethod
    def clean_cnpj(cls, v: str) -> str:
        if isinstance(v, str):
            return "".join(filter(str.isdigit, v))
        return v


class TomadorFiscalSchema(BaseModel):
    documento: str = Field(..., description="CPF (11 dígitos) ou CNPJ (14 dígitos) do tomador")
    nome: str = Field(..., min_length=2, max_length=255)
    inscricao_municipal: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    endereco_logradouro: Optional[str] = None
    endereco_numero: Optional[str] = None
    endereco_bairro: Optional[str] = None
    endereco_municipio_ibge: Optional[str] = None
    endereco_uf: Optional[str] = None
    endereco_cep: Optional[str] = None

    @field_validator("documento", mode="before")
    @classmethod
    def clean_document(cls, v: str) -> str:
        if isinstance(v, str):
            return "".join(filter(str.isdigit, v))
        return v


class ObraConstrucaoCivilSchema(BaseModel):
    cno: Optional[str] = Field(None, description="Cadastro Nacional de Obras (CNO) do canteiro")
    art: Optional[str] = Field(None, description="Anotação de Responsabilidade Técnica (ART/RRT)")
    codigo_obra: Optional[str] = None
    municipio_obra_ibge: str = Field(..., min_length=7, max_length=7, description="Código IBGE 7 dígitos do local da obra")
    municipio_obra_nome: Optional[str] = None


class ValoresServicoNfseSchema(BaseModel):
    valor_servicos: Decimal = Field(..., gt=0, description="Valor bruto dos serviços de engenharia medidos")
    valor_deducoes: Decimal = Field(default=Decimal("0.00"), ge=0, description="Deduções legais da base do ISS")
    aliquota_iss: Decimal = Field(default=Decimal("5.00"), ge=0, le=10, description="Alíquota do ISS municipal (2.00 a 5.00%)")
    iss_retido: Optional[bool] = Field(None, description="Se omitido, o motor avalia município prestador vs obra")
    aliquota_inss: Optional[Decimal] = Field(default=Decimal("5.00"), ge=0, description="Retenção técnica / previdenciária")
    aliquota_irrf: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0)
    aliquota_csll: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0)
    aliquota_pis: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0)
    aliquota_cofins: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0)


class CertificadoA1Payload(BaseModel):
    pfx_base64: Optional[str] = Field(None, description="Conteúdo binário do arquivo .pfx/.p12 codificado em Base64")
    password: Optional[str] = Field(None, description="Senha do certificado digital A1")
    use_mock_test: bool = Field(default=False, description="Simula transmissão HTTPS com certificado em homologação")


class IssueNfseRequest(BaseModel):
    project_id: Optional[UUID] = None
    measurement_id: Optional[UUID] = None
    client_id: Optional[UUID] = None
    numero_dps: Optional[int] = None
    serie_dps: str = Field(default="1", max_length=5)
    codigo_tributacao_lc116: str = Field(default="07.02", description="Item da LC 116/2003 (ex: 07.02 ou 07.05)")
    codigo_tributacao_nacional: str = Field(default="070201", description="Código de tributação no Padrão Nacional")
    discriminacao_servicos: str = Field(..., min_length=5, description="Descrição dos serviços de engenharia executados")
    prestador: Optional[PrestadorFiscalSchema] = None
    tomador: Optional[TomadorFiscalSchema] = None
    obra: Optional[ObraConstrucaoCivilSchema] = None
    valores: ValoresServicoNfseSchema
    certificado: Optional[CertificadoA1Payload] = None
    whatsapp_notification: bool = True
    whatsapp_recipient: Optional[str] = Field(None, description="Telefone com DDD para recebimento de DANFSE e XML via WhatsApp")
    environment: str = Field(default="homologacao", description="Ambiente de emissão: homologacao ou producao")


class IssueNfseResponse(BaseModel):
    success: bool
    invoice_id: UUID
    status: str
    number: int
    series: str
    access_key: str
    dps_number: int
    protocol_number: str
    authorized_at: str
    gross_amount: Decimal
    calculation_base: Decimal
    iss_rate: Decimal
    iss_amount: Decimal
    iss_retained: bool
    iss_retained_amount: Decimal
    inss_retained_amount: Decimal
    net_amount: Decimal
    xml_url: str
    pdf_url: str
    whatsapp_dispatched: bool
    whatsapp_status: Optional[Dict[str, Any]] = None
    details: Dict[str, Any]
