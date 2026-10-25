from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_EVEN
import logging
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import UUID
from fastapi import HTTPException, status
from app.services.tax_calculator import TaxCalculator

logger = logging.getLogger("gadap.subcontracts.compliance")

FOUR_PLACES = Decimal("0.0001")
REQUIRED_COMPLIANCE_DOCS: Set[str] = {"GFIP", "CND", "FGTS"}


class ComplianceBlockedException(HTTPException):
    """
    Exceção de Trava Financeira acionada quando uma medição de subempreiteiro
    não cumpre os requisitos obrigatórios de regularidade trabalhista/previdenciária.
    """
    def __init__(self, detail_info: Dict[str, Any]):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "COMPLIANCE_LOCK_ACTIVE",
                "message": (
                    "Bloqueio Financeiro de Passivo Trabalhista: A medição não pode ser aprovada "
                    "e nenhum lançamento de Contas a Pagar pode ser gerado sem a apresentação e "
                    "verificação integral dos documentos de regularidade obrigatórios (GFIP, CND, FGTS)."
                ),
                "compliance_audit": detail_info,
            },
        )


class SubcontractComplianceService:
    """
    Serviço central de Governança Trabalhista, Trava Financeira, Retenções Fiscais
    e Farol de Risco para Terceirizados e Subempreiteiras (Fase 13).
    """

    @classmethod
    def audit_measurement_compliance(
        cls,
        documents: List[Dict[str, Any]],
        required_doc_types: Optional[Set[str]] = None,
    ) -> Dict[str, Any]:
        """
        REGRA DE NEGÓCIO 1 (Auditoria de Regularidade Trabalhista):
        Verifica se a medição possui todos os documentos obrigatórios anexados e se todos
        foram formalmente auditados e verificados (is_verified == True).
        """
        required = set(required_doc_types or REQUIRED_COMPLIANCE_DOCS)

        provided_types: Set[str] = set()
        verified_types: Set[str] = set()
        unverified_docs: List[Dict[str, Any]] = []

        for doc in documents:
            doc_type = str(doc.get("document_type", "")).upper().strip()
            provided_types.add(doc_type)

            if doc.get("is_verified") is True:
                verified_types.add(doc_type)
            else:
                unverified_docs.append({
                    "id": str(doc.get("id")),
                    "document_type": doc_type,
                    "file_url": doc.get("file_url"),
                    "notes": doc.get("notes"),
                })

        missing_types = required - provided_types
        unverified_required_types = (provided_types & required) - verified_types

        blocking_reasons: List[str] = []
        for m in sorted(missing_types):
            blocking_reasons.append(f"Documento obrigatório ausente: {m}")
        for u in sorted(unverified_required_types):
            blocking_reasons.append(f"Documento {u} foi anexado mas ainda NÃO foi verificado (is_verified == false)")

        is_compliant = len(missing_types) == 0 and len(unverified_required_types) == 0

        audit_result = {
            "is_compliant": is_compliant,
            "required_documents": sorted(list(required)),
            "provided_documents": sorted(list(provided_types)),
            "missing_documents": sorted(list(missing_types)),
            "unverified_documents": [d["document_type"] for d in unverified_docs],
            "verified_documents": sorted(list(verified_types)),
            "blocking_reasons": blocking_reasons,
        }

        return audit_result

    @classmethod
    def calculate_tax_and_technical_withholdings(
        cls,
        measured_value: Decimal,
        technical_retention_percentage: Decimal,
        supplier_tax_regime: Optional[str] = None,
        custom_iss_rate: Optional[Decimal] = None,
        custom_inss_rate: Optional[Decimal] = None,
    ) -> Dict[str, Decimal]:
        """
        REGRA DE NEGÓCIO 2 (Retenção Fiscal & Técnica):
        Cruza com as regras tributárias para abater:
          1. Retenção Técnica Contratual (ex: 5% a 10% da medição).
          2. Retenção Previdenciária de INSS (11% conforme Lei 8.212/91, art. 31).
          3. Retenção Municipal de ISS (padrão 5% ou taxa customizada).
          4. Aplica Bypass Fiscal caso o terceirizado seja MEI (0% de retenção na fonte).
        """
        val_medido = Decimal(str(measured_value)).quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)
        if val_medido < Decimal("0.0000"):
            val_medido = Decimal("0.0000")

        # 1. Retenção Técnica Contratual
        tech_rate = Decimal(str(technical_retention_percentage))
        if tech_rate > Decimal("1.0"):
            tech_rate = tech_rate / Decimal("100.0")

        technical_retention = (val_medido * tech_rate).quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)

        # 2. Avaliação de Regime Tributário (Bypass Fiscal MEI)
        regime = (supplier_tax_regime or "").strip().lower()
        is_mei = regime == "mei"

        if is_mei:
            logger.info("Fornecedor/Subempreiteiro é MEI: Ativando Bypass Fiscal de retenções na fonte.")
            inss_retention = Decimal("0.0000")
            iss_retention = Decimal("0.0000")
            tax_withholding = Decimal("0.0000")
        else:
            # 3. Retenção de INSS (padrão 11% sobre o valor dos serviços)
            inss_rate = (
                Decimal(str(custom_inss_rate))
                if custom_inss_rate is not None
                else Decimal("0.1100")
            )
            if inss_rate > Decimal("1.0"):
                inss_rate = inss_rate / Decimal("100.0")
            inss_retention = (val_medido * inss_rate).quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)

            # 4. Retenção de ISS Municipal (padrão 5% sobre a base tributável)
            iss_rate = (
                Decimal(str(custom_iss_rate))
                if custom_iss_rate is not None
                else Decimal("0.0500")
            )
            if iss_rate > Decimal("1.0"):
                iss_rate = iss_rate / Decimal("100.0")
            iss_retention = (val_medido * iss_rate).quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)

            tax_withholding = (inss_retention + iss_retention).quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)

        # 5. Valor Líquido Efetivamente a Pagar
        total_abatimentos = technical_retention + tax_withholding
        net_payable = val_medido - total_abatimentos
        if net_payable < Decimal("0.0000"):
            net_payable = Decimal("0.0000")

        return {
            "measured_value": val_medido,
            "technical_retention_amount": technical_retention,
            "inss_retention_amount": inss_retention,
            "iss_retention_amount": iss_retention,
            "tax_withholding_amount": tax_withholding,
            "net_payable_amount": net_payable,
        }

    @classmethod
    def calculate_risk_traffic_light(
        cls,
        contract_value: Decimal,
        total_paid: Decimal,
        total_measured: Decimal,
    ) -> Dict[str, Any]:
        """
        REGRA DO FAROL:
        Avalia o risco físico-financeiro do subcontrato comparando Desembolsos vs Medição física:
          - GREEN (Ok): Pagamentos <= Medição.
          - YELLOW (Atenção): Pagamentos > Medição, mas < 80% do Contrato.
          - RED (Risco): Pagamentos > Medição E >= 80% do Contrato.
        """
        v_contrato = max(Decimal("0.0000"), Decimal(str(contract_value or "0.0000")))
        p = max(Decimal("0.0000"), Decimal(str(total_paid or "0.0000")))
        m = max(Decimal("0.0000"), Decimal(str(total_measured or "0.0000")))

        exposure = max(Decimal("0.0000"), p - m)
        eighty_percent = (v_contrato * Decimal("0.8000")).quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)

        if p <= m:
            status = "GREEN"
            description = "GREEN (Ok): Pagamentos acumulados cobertos por medições físicas aprovadas."
        elif p > m and p < eighty_percent:
            status = "YELLOW"
            description = (
                f"YELLOW (Atenção): Desembolsos superam o avanço medido em R$ {exposure:,.2f}, "
                f"porém ainda abaixo de 80% do valor global do contrato (limite: R$ {eighty_percent:,.2f})."
            )
        else:
            status = "RED"
            description = (
                f"RED (Risco Crítico): Pagamentos superam as medições (Exposição: R$ {exposure:,.2f}) "
                f"E já atingiram ou ultrapassaram 80% do contrato global (Total Pago: R$ {p:,.2f} >= R$ {eighty_percent:,.2f}). "
                f"Alerta máximo de risco de abandono ou descompasso físico-financeiro!"
            )

        return {
            "risk_status": status,
            "risk_description": description,
            "total_paid": p,
            "total_measured": m,
            "contract_value": v_contrato,
            "financial_exposure": exposure,
            "eighty_percent_threshold": eighty_percent,
        }

    @classmethod
    def enforce_compliance_and_prepare_financial_entry(
        cls,
        subcontract: Dict[str, Any],
        sub_measurement: Dict[str, Any],
        documents: List[Dict[str, Any]],
        supplier_tax_regime: Optional[str] = None,
        custom_iss_rate: Optional[Decimal] = None,
        custom_inss_rate: Optional[Decimal] = None,
        due_date: Optional[date] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Executa simultaneamente as Regras de Negócio 1 e 2:
        1. Se a auditoria falhar, lança ComplianceBlockedException e bloqueia a execução.
        2. Se aprovada, calcula retenções fiscais determinísticas.
        3. Prepara o payload para inserção atômica na tabela 'financial_entries' (Contas a Pagar).
        """
        # REGRA 1: Trava de Compliance
        audit = cls.audit_measurement_compliance(documents)
        if not audit["is_compliant"]:
            logger.warning(
                "Tentativa de aprovação de medição %s bloqueada pela Trava de Compliance Trabalhista.",
                sub_measurement.get("id"),
            )
            raise ComplianceBlockedException(audit)

        # REGRA 2: Retenção Fiscal e Técnica
        measured_val = Decimal(str(sub_measurement.get("measured_value", "0.0000")))
        tech_perc = Decimal(str(subcontract.get("technical_retention_percentage", "0.0500")))

        withholdings = cls.calculate_tax_and_technical_withholdings(
            measured_value=measured_val,
            technical_retention_percentage=tech_perc,
            supplier_tax_regime=supplier_tax_regime,
            custom_iss_rate=custom_iss_rate,
            custom_inss_rate=custom_inss_rate,
        )

        # Cálculo do vencimento: D+15 a partir da data de medição se não informado
        meas_date_raw = sub_measurement.get("measurement_date")
        if isinstance(meas_date_raw, str):
            meas_date = date.fromisoformat(meas_date_raw)
        elif isinstance(meas_date_raw, date):
            meas_date = meas_date_raw
        else:
            meas_date = date.today()

        entry_due_date = due_date or (meas_date + timedelta(days=15))

        contract_num = subcontract.get("contract_number") or str(subcontract.get("id", ""))[:8]
        measurement_num = sub_measurement.get("measurement_number", 1)

        # Payload para criação do Contas a Pagar (financial_entries)
        financial_entry_payload = {
            "tenant_id": str(subcontract["tenant_id"]),
            "project_id": str(subcontract["project_id"]) if subcontract.get("project_id") else None,
            "supplier_id": str(subcontract["supplier_id"]),
            "entry_type": "payable",
            "description": f"Medição Terceirizado #{measurement_num} - Contrato {contract_num}",
            "category": "subempreiteiros",
            "nominal_amount": float(withholdings["measured_value"]),
            "technical_retention_amount": float(withholdings["technical_retention_amount"]),
            "discount_amount": float(withholdings["tax_withholding_amount"]), # Desconto fiscal abatido do pagamento
            "net_amount": float(withholdings["net_payable_amount"]),
            "status": "pendente",
            "due_date": entry_due_date.isoformat(),
            "document_number": f"MED-SUB-{contract_num}-{measurement_num}",
            "document_type": "medicao_terceirizado",
            "notes": (
                f"Aprovado após auditoria de compliance (GFIP/CND/FGTS). "
                f"Retenção INSS: R$ {withholdings['inss_retention_amount']:.2f} | "
                f"Retenção ISS: R$ {withholdings['iss_retention_amount']:.2f} | "
                f"Retenção Técnica ({float(tech_perc)*100:.1f}%): R$ {withholdings['technical_retention_amount']:.2f}."
                + (f" Obs: {notes}" if notes else "")
            ),
        }

        return {
            "audit": audit,
            "withholdings": withholdings,
            "financial_entry_payload": financial_entry_payload,
        }
