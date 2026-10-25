"""
=============================================================================
GADAP Hub - Schemas de Tax Intelligence & Monitoramento Legal (Fase 10)
Arquivo: api/app/schemas/intelligence.py
=============================================================================
"""

from datetime import date, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class LegislationImpactLevel:
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class LegislationCategory:
    TAX = "tax"
    ISS = "iss"
    INSS = "inss"
    IRRF = "irrf"
    NFSE = "nfse"
    IBPT = "ibpt"
    REFORMA_TRIBUTARIA = "reforma_tributaria"
    TRABALHISTA = "trabalhista"
    AMBIENTAL = "ambiental"


class LegislationUpdateBase(BaseModel):
    source: str = Field(..., description="Fonte oficial da atualização (ex: IBPT, Receita Federal, Planalto, SEFAZ)")
    title: str = Field(..., min_length=3, max_length=255, description="Título descritivo da alteração ou nota fiscal")
    summary: str = Field(..., description="Resumo executivo do impacto na construção civil e engenharia")
    law_reference: Optional[str] = Field(None, max_length=100, description="Número/Artigo da lei ou Nota Técnica (ex: LC 116/2003, NT 2026.002)")
    category: str = Field(default="tax", description="Categoria tributária (iss, inss, irrf, nfse, ibpt, reforma_tributaria)")
    impact_level: str = Field(default="info", description="Nível de impacto: info, warning ou critical")
    effective_date: Optional[date] = Field(None, description="Data de entrada em vigor ou publicação oficial")
    details: Dict[str, Any] = Field(default_factory=dict, description="Metadados complementares (alíquotas, regras de retenção, NCM/NBS)")


class LegislationUpdateCreate(LegislationUpdateBase):
    tenant_id: Optional[UUID] = Field(None, description="ID do Tenant opcional (None = alerta global do ecossistema)")
    raw_content: Optional[str] = Field(None, description="Conteúdo bruto capturado via scraping ou payload de API")
    content_hash: str = Field(..., description="Hash SHA-256 de identificação unívoca para detecção de duplicidades")


class LegislationUpdateResponse(LegislationUpdateBase):
    id: UUID
    tenant_id: Optional[UUID] = None
    content_hash: str
    detected_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LegislationAlertsListResponse(BaseModel):
    total: int = Field(..., description="Quantidade total de alertas localizados")
    sources_monitored: List[str] = Field(..., description="Fontes rastreadas ativamente pelo monitor")
    last_sync_at: Optional[datetime] = Field(None, description="Data e hora da última sincronização bem-sucedida")
    alerts: List[LegislationUpdateResponse] = Field(..., description="Lista de atualizações e alertas ordenados por criticidade")


class LegislationSyncResponse(BaseModel):
    status: str = Field(..., description="Resultado do ciclo de monitoramento")
    checked_sources: int = Field(..., description="Número de fontes governamentais/fiscais consultadas")
    new_alerts_detected: int = Field(..., description="Número de alterações inéditas registradas no banco")
    message: str = Field(..., description="Mensagem de resumo do ciclo de Tax Intelligence")
    details: List[Dict[str, Any]] = Field(default_factory=list, description="Detalhes das novas ocorrências salvas")


# ------------------------------------------------------------------------------
# Schemas de OCR Preditivo de Documentos Fiscais de Fornecedores (Contas a Pagar)
# ------------------------------------------------------------------------------
class OcrItemSchema(BaseModel):
    item_numero: Optional[int] = Field(None, description="Número ordinal do item na nota (1, 2, ...)")
    codigo: Optional[str] = Field(None, description="Código do produto ou NCM (8 dígitos)")
    descricao: str = Field(..., description="Descrição detalhada do insumo ou material")
    unidade: Optional[str] = Field("UN", description="Unidade de medida (SC, UN, KG, M, M2, M3, BR, PC, etc.)")
    quantidade: float = Field(..., ge=0, description="Quantidade faturada")
    valor_unitario: float = Field(..., ge=0, description="Preço unitário do insumo")
    valor_total: float = Field(..., ge=0, description="Valor total do item")


class OcrFornecedorSchema(BaseModel):
    razao_social: str = Field(..., description="Razão Social ou Nome Empresarial do Fornecedor")
    nome_fantasia: Optional[str] = Field(None, description="Nome Fantasia do Fornecedor")
    cnpj: str = Field(..., description="CNPJ do Fornecedor sanitizado (14 dígitos numéricos)")
    inscricao_estadual: Optional[str] = Field(None, description="Inscrição Estadual")
    cidade: Optional[str] = Field(None, description="Município do Fornecedor")
    uf: Optional[str] = Field(None, description="UF do Fornecedor (2 letras)")


class OcrParsedPayload(BaseModel):
    fornecedor: OcrFornecedorSchema = Field(..., description="Dados cadastrais do fornecedor extraídos da nota")
    data_emissao: Optional[str] = Field(None, description="Data de emissão do documento no formato AAAA-MM-DD")
    data_vencimento: Optional[str] = Field(None, description="Data de vencimento para o Contas a Pagar (AAAA-MM-DD)")
    numero_nota: Optional[str] = Field(None, description="Número da Nota Fiscal (NF-e, NFC-e, NFS-e ou Recibo)")
    serie: Optional[str] = Field("1", description="Série do documento fiscal")
    chave_acesso: Optional[str] = Field(None, description="Chave de acesso de 44 ou 50 dígitos numéricos")
    tipo_documento: Optional[str] = Field("NFE", description="Tipo identificado: NFE, NFCE, NFSE, RECIBO_COMPRA")
    valor_total: float = Field(..., ge=0, description="Valor Total da Nota Fiscal (a ser lançado no Contas a Pagar)")
    valor_produtos: Optional[float] = Field(None, ge=0, description="Soma dos valores dos produtos/materiais")
    valor_frete: Optional[float] = Field(0.0, ge=0, description="Valor do frete destacado")
    valor_desconto: Optional[float] = Field(0.0, ge=0, description="Valor de descontos aplicados")
    itens: List[OcrItemSchema] = Field(default_factory=list, description="Lista de insumos/itens discriminados")
    tributos: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Tributos destacados (ICMS, IPI, PIS, COFINS, ISS)")
    observacoes: Optional[str] = Field(None, description="Informações complementares ou condições de pagamento")


class OcrParseResponse(BaseModel):
    success: bool = Field(True, description="Indicador de sucesso do parsing preditivo")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Índice de acurácia preditiva da extração (0.00 a 1.00)")
    parsed_payload: OcrParsedPayload = Field(..., description="Carga de dados fiscais estruturada para o Contas a Pagar")
    processing_time_seconds: Optional[float] = Field(None, description="Tempo total de processamento e inferência da IA")
    file_info: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Metadados do arquivo temporário enviado")
