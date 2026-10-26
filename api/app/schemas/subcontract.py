from datetime import date as dt_date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class SubcontractStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    COMPLETED = "completed"
    TERMINATED = "terminated"
    DRAFT = "draft"


class SubMeasurementStatus(str, Enum):
    DRAFT = "draft"
    PENDING_DOCUMENTS = "pending_documents"
    COMPLIANCE_APPROVED = "compliance_approved"
    APPROVED = "approved"
    PAID = "paid"
    REJECTED = "rejected"


class ComplianceDocType(str, Enum):
    GFIP = "GFIP"
    CND = "CND"
    FGTS = "FGTS"
    FOLHA_PAGAMENTO = "FOLHA_PAGAMENTO"
    ASO = "ASO"
    OUTROS = "OUTROS"


class TransactionType(str, Enum):
    PAYMENT = "PAYMENT"
    MEASUREMENT = "MEASUREMENT"


class RiskStatus(str, Enum):
    GREEN = "GREEN"    # Pagamentos <= Medição (Ok)
    YELLOW = "YELLOW"  # Pagamentos > Medição, mas < 80% do Contrato (Atenção)
    RED = "RED"        # Pagamentos > Medição E >= 80% do Contrato (Risco)


# ------------------------------------------------------------------------------
# 1. Schemas de Especialidades Técnicas (Specialties)
# ------------------------------------------------------------------------------
class SpecialtyBase(BaseModel):
    name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Nome da especialidade (ex: Elétrica, Hidráulica, Alvenaria, Pintura)",
        examples=["Elétrica"],
    )
    description: Optional[str] = Field(
        None,
        max_length=255,
        description="Descrição detalhada do campo de atuação",
        examples=["Instalações de média/baixa tensão e infraestrutura"],
    )


class SpecialtyCreate(SpecialtyBase):
    pass


class SpecialtyResponse(SpecialtyBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupplierSpecialtyLink(BaseModel):
    specialty_ids: List[UUID] = Field(
        ...,
        description="Lista de IDs de especialidades a associar ao fornecedor",
    )


# ------------------------------------------------------------------------------
# 2. Schemas de Documentos de Compliance (GFIP, CND, FGTS)
# ------------------------------------------------------------------------------
class ComplianceDocumentBase(BaseModel):
    document_type: ComplianceDocType = Field(
        ...,
        description="Tipo de documento obrigatório de compliance trabalhista/previdenciário",
        examples=[ComplianceDocType.GFIP],
    )
    file_url: str = Field(
        ...,
        description="URL de armazenamento do arquivo (Supabase Storage / S3)",
        examples=["https://storage.gadap.com.br/compliance/gfip_competencia_10_2026.pdf"],
    )
    notes: Optional[str] = Field(
        None,
        max_length=500,
        description="Observações técnicas ou número de protocolo da certidão",
        examples=["GFIP com código 150 e comprovante de transmissão Conectividade Social"],
    )


class ComplianceDocumentCreate(ComplianceDocumentBase):
    pass


class ComplianceDocumentVerify(BaseModel):
    is_verified: bool = Field(
        ...,
        description="Status de auditoria humana/IA: true para aprovado e sem pendências",
        examples=[True],
    )
    notes: Optional[str] = Field(
        None,
        description="Parecer técnico da auditoria documental",
        examples=["Documento conferido e válido até 30/11/2026."],
    )


class ComplianceDocumentResponse(ComplianceDocumentBase):
    id: UUID
    tenant_id: UUID
    sub_measurement_id: UUID
    is_verified: bool
    verified_at: Optional[datetime] = None
    verified_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ComplianceCheckSummary(BaseModel):
    is_compliant: bool = Field(
        ...,
        description="Indica se a medição atende 100% dos requisitos documentais para liberação de pagamento",
    )
    required_documents: List[str] = Field(
        default=["GFIP", "CND", "FGTS"],
        description="Lista de tipos documentais exigidos por política corporativa",
    )
    provided_documents: List[str] = Field(
        default=[],
        description="Documentos já anexados pelo subempreiteiro",
    )
    missing_documents: List[str] = Field(
        default=[],
        description="Documentos obrigatórios ausentes",
    )
    unverified_documents: List[str] = Field(
        default=[],
        description="Documentos anexados porém ainda pendentes de conferência (is_verified == false)",
    )
    verified_documents: List[str] = Field(
        default=[],
        description="Documentos conferidos e aprovados",
    )
    blocking_reasons: List[str] = Field(
        default=[],
        description="Motivos que impedem a liberação do Contas a Pagar",
    )


# ------------------------------------------------------------------------------
# 3. Schemas de Medições de Subempreiteiros (SubMeasurements)
# ------------------------------------------------------------------------------
class SubMeasurementBase(BaseModel):
    measurement_number: Optional[int] = Field(
        default=1,
        ge=1,
        description="Número sequencial do boletim de medição",
        examples=[1],
    )
    measured_value: Decimal = Field(
        ...,
        ge=Decimal("0"),
        decimal_places=4,
        description="Valor bruto medido dos serviços executados no período (R$)",
        examples=[Decimal("15000.0000")],
    )
    invoice_url: Optional[str] = Field(
        None,
        description="URL da Nota Fiscal de Serviço emitida pelo prestador",
        examples=["https://storage.gadap.com.br/invoices/nfse_subempreiteiro_4512.pdf"],
    )
    measurement_date: Optional[dt_date] = Field(
        default_factory=dt_date.today,
        description="Data de referência ou fechamento do boletim de medição",
        examples=["2026-10-25"],
    )
    notes: Optional[str] = Field(
        None,
        description="Relatório de avanço físico de campo ou ressalvas da fiscalização",
    )


class SubMeasurementCreate(SubMeasurementBase):
    subcontract_id: UUID = Field(
        ...,
        description="ID do subcontrato ao qual a medição está vinculada",
    )


class SubMeasurementUpdate(BaseModel):
    measured_value: Optional[Decimal] = Field(None, ge=Decimal("0"), decimal_places=4)
    invoice_url: Optional[str] = None
    measurement_date: Optional[dt_date] = None
    notes: Optional[str] = None


class SubMeasurementApprovalRequest(BaseModel):
    due_date: Optional[dt_date] = Field(
        None,
        description="Data de vencimento para o Contas a Pagar gerado. Se nulo, adota D+15.",
        examples=["2026-11-10"],
    )
    custom_iss_rate: Optional[Decimal] = Field(
        None,
        ge=Decimal("0"),
        le=Decimal("0.10"),
        description="Alíquota específica de ISS municipal (ex: 5% = 0.05). Se nulo, adota 5%.",
        examples=[Decimal("0.0500")],
    )
    custom_inss_rate: Optional[Decimal] = Field(
        None,
        ge=Decimal("0"),
        le=Decimal("0.20"),
        description="Alíquota de INSS retenção (ex: 11% = 0.11). Se nulo, adota 11% para não-MEI.",
        examples=[Decimal("0.1100")],
    )
    notes: Optional[str] = Field(
        None,
        description="Despacho de aprovação financeira",
    )


class SubMeasurementResponse(SubMeasurementBase):
    id: UUID
    tenant_id: UUID
    subcontract_id: UUID
    technical_retention_amount: Decimal = Field(default=Decimal("0.0000"))
    inss_retention_amount: Decimal = Field(default=Decimal("0.0000"))
    iss_retention_amount: Decimal = Field(default=Decimal("0.0000"))
    tax_withholding_amount: Decimal = Field(default=Decimal("0.0000"))
    net_payable_amount: Decimal = Field(default=Decimal("0.0000"))
    status: SubMeasurementStatus
    financial_entry_id: Optional[UUID] = None
    compliance_checked_at: Optional[datetime] = None
    compliance_checked_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    compliance_documents: Optional[List[ComplianceDocumentResponse]] = None
    subcontracts: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


# ------------------------------------------------------------------------------
# 4. Schemas de Transações da Conta Corrente (Subcontract Transactions)
# ------------------------------------------------------------------------------
class SubcontractTransactionBase(BaseModel):
    type: TransactionType = Field(
        ...,
        description="Tipo de movimentação na conta corrente: 'PAYMENT' (Desembolso/Pagamento) ou 'MEASUREMENT' (Avanço Medido)",
        examples=[TransactionType.PAYMENT],
    )
    amount: Decimal = Field(
        ...,
        ge=Decimal("0"),
        decimal_places=4,
        description="Valor da movimentação financeira (R$)",
        examples=[Decimal("12000.0000")],
    )
    date: Optional[dt_date] = Field(
        default_factory=dt_date.today,
        description="Data da movimentação",
        examples=["2026-10-25"],
    )
    observation: Optional[str] = Field(
        None,
        max_length=500,
        description="Histórico da transação (ex: Adiantamento quinzenal de mão de obra)",
        examples=["Adiantamento para compra de materiais e diárias"],
    )


class SubcontractTransactionCreate(SubcontractTransactionBase):
    due_date: Optional[dt_date] = Field(
        None,
        description="Data de vencimento para o lançamento em Contas a Pagar (se type == 'PAYMENT')",
    )
    create_financial_entry: bool = Field(
        default=True,
        description="Integração automática com o Módulo Financeiro (gera lançamento em financial_entries)",
    )


class SubcontractTransactionResponse(SubcontractTransactionBase):
    id: UUID
    tenant_id: UUID
    subcontract_id: UUID
    financial_entry_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ------------------------------------------------------------------------------
# 5. Schemas do Subcontrato Principal (Subcontracts) & Farol de Risco
# ------------------------------------------------------------------------------
class SubcontractBase(BaseModel):
    project_id: Optional[UUID] = Field(
        None,
        description="ID da obra à qual o subcontrato está vinculado",
    )
    supplier_id: UUID = Field(
        ...,
        description="ID do fornecedor/subempreiteiro contratado",
    )
    contract_number: Optional[str] = Field(
        None,
        max_length=50,
        description="Código ou número de identificação do contrato (ex: SUB-2026-001)",
        examples=["SUB-2026-001"],
    )
    scope_description: str = Field(
        ...,
        min_length=5,
        description="Descrição detalhada do escopo de serviços contratados",
        examples=["Instalação de revestimentos cerâmicos e porcelanatos nos blocos A e B"],
    )
    total_value: Decimal = Field(
        ...,
        ge=Decimal("0"),
        decimal_places=4,
        description="Valor total global do subcontrato (R$)",
        examples=[Decimal("85000.0000")],
    )
    technical_retention_percentage: Decimal = Field(
        default=Decimal("0.0500"),
        ge=Decimal("0"),
        le=Decimal("1.0000"),
        description="Percentual de retenção técnica como garantia contratual (ex: 5% = 0.0500)",
        examples=[Decimal("0.0500")],
    )
    status: SubcontractStatus = Field(
        default=SubcontractStatus.ACTIVE,
        description="Status operacional do subcontrato",
        examples=[SubcontractStatus.ACTIVE],
    )
    start_date: Optional[dt_date] = Field(None, description="Data de início da prestação dos serviços")
    end_date: Optional[dt_date] = Field(None, description="Data prevista de conclusão dos serviços")
    notes: Optional[str] = Field(None, description="Observações contratuais e cláusulas de garantia")

    @field_validator("technical_retention_percentage")
    @classmethod
    def normalize_percentage(cls, v: Decimal) -> Decimal:
        if v > Decimal("1.0"):
            v = v / Decimal("100.0")
        return v


class SubcontractCreate(SubcontractBase):
    pass


class SubcontractUpdate(BaseModel):
    project_id: Optional[UUID] = None
    supplier_id: Optional[UUID] = None
    contract_number: Optional[str] = None
    scope_description: Optional[str] = None
    total_value: Optional[Decimal] = None
    technical_retention_percentage: Optional[Decimal] = None
    status: Optional[SubcontractStatus] = None
    start_date: Optional[dt_date] = None
    end_date: Optional[dt_date] = None
    notes: Optional[str] = None

    @field_validator("technical_retention_percentage")
    @classmethod
    def normalize_percentage(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v > Decimal("1.0"):
            v = v / Decimal("100.0")
        return v


class SubcontractResponse(SubcontractBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    suppliers: Optional[Dict[str, Any]] = None
    projects: Optional[Dict[str, Any]] = None
    specialties: List[str] = Field(
        default=[],
        description="Lista de especialidades de atuação do fornecedor",
        examples=[["Elétrica", "Hidráulica"]],
    )
    total_paid: Decimal = Field(
        default=Decimal("0.0000"),
        description="Total desembolsado e pago ao terceirizado na conta corrente",
        examples=[Decimal("20000.0000")],
    )
    total_measured: Decimal = Field(
        default=Decimal("0.0000"),
        description="Total físico acumulado em medições aprovadas",
        examples=[Decimal("25000.0000")],
    )
    balance_remaining: Decimal = Field(
        default=Decimal("0.0000"),
        description="Saldo residual a medir do contrato (total_value - total_measured)",
    )
    financial_exposure: Decimal = Field(
        default=Decimal("0.0000"),
        description="Exposição desprotegida (pagamentos sem medição física correspondente: total_paid - total_measured)",
    )
    risk_status: RiskStatus = Field(
        default=RiskStatus.GREEN,
        description="Farol de Risco: GREEN (Pagamentos <= Medição), YELLOW (Pagamentos > Medição, < 80% Contrato), RED (Pagamentos > Medição e >= 80% Contrato)",
        examples=[RiskStatus.GREEN],
    )
    risk_description: str = Field(
        default="Ok: Pagamentos cobertos por medição física.",
        description="Diagnóstico técnico explicativo do farol de risco",
    )
    sub_measurements: Optional[List[SubMeasurementResponse]] = None
    transactions: Optional[List[SubcontractTransactionResponse]] = None

    class Config:
        from_attributes = True


class SubcontractAccountStatement(BaseModel):
    subcontract_id: UUID
    contract_number: Optional[str]
    total_value: Decimal
    total_measured: Decimal
    total_paid: Decimal
    balance_to_measure: Decimal
    financial_exposure: Decimal
    risk_status: RiskStatus
    risk_description: str
    supplier: Dict[str, Any]
    specialties: List[str]
    transactions: List[SubcontractTransactionResponse]
