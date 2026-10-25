from datetime import date, datetime
from decimal import Decimal
import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
import httpx
from app.core.config import settings
from app.core.deps import get_current_tenant_and_token
from app.schemas.subcontract import (
    ComplianceCheckSummary,
    ComplianceDocumentCreate,
    ComplianceDocumentResponse,
    ComplianceDocumentVerify,
    SubMeasurementApprovalRequest,
    SubMeasurementCreate,
    SubMeasurementResponse,
    SubMeasurementStatus,
    SubMeasurementUpdate,
    SubcontractCreate,
    SubcontractResponse,
    SubcontractStatus,
    SubcontractUpdate,
)
from app.services.subcontract_compliance_service import (
    ComplianceBlockedException,
    SubcontractComplianceService,
)

logger = logging.getLogger("gadap.subcontracts")

router = APIRouter()


def _get_supabase_headers(token: str) -> Dict[str, str]:
    return {
        "apikey": settings.SUPABASE_ANON_KEY or "",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


# ==============================================================================
# 1. ROTAS DE SUBCONTRATOS (SUBCONTRACTS)
# ==============================================================================

@router.get(
    "/",
    response_model=List[SubcontractResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar Subcontratos",
    description="Retorna a lista de subcontratos com fornecedores e terceirizados do tenant.",
)
async def list_subcontracts(
    project_id: Optional[UUID] = Query(None, description="Filtrar por obra"),
    supplier_id: Optional[UUID] = Query(None, description="Filtrar por fornecedor"),
    status_filter: Optional[SubcontractStatus] = Query(None, alias="status", description="Filtrar por status"),
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> List[SubcontractResponse]:
    tenant_id, token = auth_data
    supabase_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/subcontracts"

    params: Dict[str, str] = {
        "tenant_id": f"eq.{tenant_id}",
        "select": "*,suppliers(id,name,trade_name,document,tax_regime),projects(id,name,code)",
        "order": "created_at.desc",
    }
    if project_id:
        params["project_id"] = f"eq.{project_id}"
    if supplier_id:
        params["supplier_id"] = f"eq.{supplier_id}"
    if status_filter:
        params["status"] = f"eq.{status_filter.value}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.get(supabase_url, headers=_get_supabase_headers(token), params=params)
            res.raise_for_status()
            return res.json()
        except Exception as exc:
            logger.error("Falha ao listar subcontratos: %s", str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao consultar subcontratos: {str(exc)}",
            ) from exc


@router.post(
    "/",
    response_model=SubcontractResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar Novo Subcontrato de Terceirizado",
    description="Registra um novo subcontrato de prestação de serviços com fornecedor/empreiteiro.",
)
async def create_subcontract(
    payload: SubcontractCreate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> SubcontractResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')
    supabase_url = f"{base_url}/rest/v1/subcontracts"

    insert_payload = {
        "tenant_id": str(tenant_id),
        "project_id": str(payload.project_id) if payload.project_id else None,
        "supplier_id": str(payload.supplier_id),
        "contract_number": payload.contract_number,
        "scope_description": payload.scope_description,
        "total_value": float(payload.total_value),
        "technical_retention_percentage": float(payload.technical_retention_percentage),
        "status": payload.status.value,
        "start_date": payload.start_date.isoformat() if payload.start_date else None,
        "end_date": payload.end_date.isoformat() if payload.end_date else None,
        "notes": payload.notes,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.post(
                f"{supabase_url}?select=*,suppliers(id,name,trade_name,document,tax_regime),projects(id,name,code)",
                headers=_get_supabase_headers(token),
                json=insert_payload,
            )
            res.raise_for_status()
            records = res.json()
            if not records:
                raise HTTPException(status_code=400, detail="Erro ao criar subcontrato.")
            return records[0]
        except httpx.HTTPStatusError as exc:
            logger.error("Erro ao inserir subcontrato: %s", exc.response.text)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Erro ao salvar subcontrato: {exc.response.text}",
            ) from exc


@router.get(
    "/{subcontract_id}",
    response_model=SubcontractResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter Subcontrato por ID",
    description="Retorna os dados detalhados do subcontrato, incluindo medições e saldos.",
)
async def get_subcontract_by_id(
    subcontract_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> SubcontractResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')
    supabase_url = f"{base_url}/rest/v1/subcontracts"

    params = {
        "id": f"eq.{subcontract_id}",
        "tenant_id": f"eq.{tenant_id}",
        "select": "*,suppliers(id,name,trade_name,document,tax_regime),projects(id,name,code),sub_measurements(*)",
        "limit": "1",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.get(supabase_url, headers=_get_supabase_headers(token), params=params)
            res.raise_for_status()
            records = res.json()
            if not records:
                raise HTTPException(status_code=404, detail="Subcontrato não encontrado.")
            record = records[0]

            # Calcula saldo medido e saldo a medir
            measurements = record.get("sub_measurements", [])
            total_measured = sum(Decimal(str(m.get("measured_value", 0))) for m in measurements if m.get("status") != "rejected")
            total_value = Decimal(str(record.get("total_value", 0)))
            record["total_measured"] = total_measured
            record["balance_remaining"] = max(Decimal("0.0000"), total_value - total_measured)

            return record
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put(
    "/{subcontract_id}",
    response_model=SubcontractResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualizar Subcontrato",
)
async def update_subcontract(
    subcontract_id: UUID,
    payload: SubcontractUpdate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> SubcontractResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')
    supabase_url = f"{base_url}/rest/v1/subcontracts"

    update_dict = payload.model_dump(exclude_unset=True)
    if "status" in update_dict and update_dict["status"]:
        update_dict["status"] = update_dict["status"].value
    if "total_value" in update_dict and update_dict["total_value"] is not None:
        update_dict["total_value"] = float(update_dict["total_value"])
    if "technical_retention_percentage" in update_dict and update_dict["technical_retention_percentage"] is not None:
        update_dict["technical_retention_percentage"] = float(update_dict["technical_retention_percentage"])
    if "start_date" in update_dict and update_dict["start_date"]:
        update_dict["start_date"] = update_dict["start_date"].isoformat()
    if "end_date" in update_dict and update_dict["end_date"]:
        update_dict["end_date"] = update_dict["end_date"].isoformat()

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.patch(
                f"{supabase_url}?id=eq.{subcontract_id}&tenant_id=eq.{tenant_id}&select=*,suppliers(id,name,trade_name,document,tax_regime),projects(id,name,code)",
                headers=_get_supabase_headers(token),
                json=update_dict,
            )
            res.raise_for_status()
            records = res.json()
            if not records:
                raise HTTPException(status_code=404, detail="Subcontrato não encontrado para atualização.")
            return records[0]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc


# ==============================================================================
# 2. ROTAS DE MEDIÇÕES DE TERCEIRIZADOS (SUB_MEASUREMENTS)
# ==============================================================================

@router.get(
    "/{subcontract_id}/measurements",
    response_model=List[SubMeasurementResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar Medições de um Subcontrato",
)
async def list_sub_measurements(
    subcontract_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> List[SubMeasurementResponse]:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')
    supabase_url = f"{base_url}/rest/v1/sub_measurements"

    params = {
        "subcontract_id": f"eq.{subcontract_id}",
        "tenant_id": f"eq.{tenant_id}",
        "select": "*,compliance_documents(*)",
        "order": "measurement_number.asc",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.get(supabase_url, headers=_get_supabase_headers(token), params=params)
            res.raise_for_status()
            return res.json()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post(
    "/{subcontract_id}/measurements",
    response_model=SubMeasurementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar Boletim de Medição de Subempreiteiro",
    description="Registra uma nova medição para o subcontrato com status inicial 'draft' ou 'pending_documents'.",
)
async def create_sub_measurement(
    subcontract_id: UUID,
    payload: SubMeasurementCreate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> SubMeasurementResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Recupera o subcontrato para calcular retenção técnica e validar existência
        sub_res = await client.get(
            f"{base_url}/rest/v1/subcontracts",
            headers=_get_supabase_headers(token),
            params={"id": f"eq.{subcontract_id}", "tenant_id": f"eq.{tenant_id}", "limit": "1"},
        )
        sub_res.raise_for_status()
        subcontracts = sub_res.json()
        if not subcontracts:
            raise HTTPException(status_code=404, detail="Subcontrato não encontrado.")
        subcontract = subcontracts[0]

        # 2. Descobre o próximo número de medição
        count_res = await client.get(
            f"{base_url}/rest/v1/sub_measurements",
            headers=_get_supabase_headers(token),
            params={"subcontract_id": f"eq.{subcontract_id}", "tenant_id": f"eq.{tenant_id}", "select": "measurement_number"},
        )
        count_res.raise_for_status()
        existing = count_res.json()
        next_number = max([m.get("measurement_number", 0) for m in existing] or [0]) + 1
        measurement_number = payload.measurement_number or next_number

        # 3. Pré-cálculo com retenção técnica
        val_medido = Decimal(str(payload.measured_value))
        tech_rate = Decimal(str(subcontract.get("technical_retention_percentage", "0.0500")))
        tech_amount = (val_medido * tech_rate).quantize(Decimal("0.0001"))

        insert_payload = {
            "tenant_id": str(tenant_id),
            "subcontract_id": str(subcontract_id),
            "measurement_number": measurement_number,
            "measured_value": float(val_medido),
            "technical_retention_amount": float(tech_amount),
            "inss_retention_amount": 0.0,
            "iss_retention_amount": 0.0,
            "tax_withholding_amount": 0.0,
            "net_payable_amount": float(val_medido - tech_amount),
            "status": SubMeasurementStatus.PENDING_DOCUMENTS.value,
            "invoice_url": payload.invoice_url,
            "measurement_date": (payload.measurement_date or date.today()).isoformat(),
            "notes": payload.notes,
        }

        try:
            res = await client.post(
                f"{base_url}/rest/v1/sub_measurements?select=*,compliance_documents(*)",
                headers=_get_supabase_headers(token),
                json=insert_payload,
            )
            res.raise_for_status()
            created = res.json()
            return created[0]
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=422, detail=f"Erro ao registrar medição: {exc.response.text}") from exc


@router.get(
    "/measurements/{measurement_id}",
    response_model=SubMeasurementResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter Detalhes da Medição de Terceirizado",
)
async def get_sub_measurement_by_id(
    measurement_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> SubMeasurementResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')
    supabase_url = f"{base_url}/rest/v1/sub_measurements"

    params = {
        "id": f"eq.{measurement_id}",
        "tenant_id": f"eq.{tenant_id}",
        "select": "*,compliance_documents(*),subcontracts(*,suppliers(id,name,trade_name,document,tax_regime),projects(id,name,code))",
        "limit": "1",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.get(supabase_url, headers=_get_supabase_headers(token), params=params)
            res.raise_for_status()
            records = res.json()
            if not records:
                raise HTTPException(status_code=404, detail="Medição não encontrada.")
            return records[0]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc


# ==============================================================================
# 3. ROTAS DE COMPLIANCE TRABALHISTA (DOCUMENTOS: GFIP, CND, FGTS)
# ==============================================================================

@router.post(
    "/measurements/{measurement_id}/documents",
    response_model=ComplianceDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Anexar Documento de Compliance Trabalhista",
    description="Anexa certidões e comprovantes (GFIP, CND, FGTS) exigidos para liberar o pagamento da medição.",
)
async def attach_compliance_document(
    measurement_id: UUID,
    payload: ComplianceDocumentCreate,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ComplianceDocumentResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    insert_payload = {
        "tenant_id": str(tenant_id),
        "sub_measurement_id": str(measurement_id),
        "document_type": payload.document_type.value,
        "file_url": payload.file_url,
        "is_verified": False,
        "notes": payload.notes,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.post(
                f"{base_url}/rest/v1/compliance_documents?select=*",
                headers=_get_supabase_headers(token),
                json=insert_payload,
            )
            res.raise_for_status()
            created = res.json()
            return created[0]
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=422, detail=f"Erro ao anexar documento: {exc.response.text}") from exc


@router.patch(
    "/documents/{document_id}/verify",
    response_model=ComplianceDocumentResponse,
    status_code=status.HTTP_200_OK,
    summary="Verificar / Auditar Documento de Compliance",
    description="Auditoria humana ou de IA que aprova ou rejeita a validade do documento anexado.",
)
async def verify_compliance_document(
    document_id: UUID,
    payload: ComplianceDocumentVerify,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ComplianceDocumentResponse:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    patch_payload = {
        "is_verified": payload.is_verified,
        "verified_at": datetime.now().isoformat() if payload.is_verified else None,
        "notes": payload.notes,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            res = await client.patch(
                f"{base_url}/rest/v1/compliance_documents?id=eq.{document_id}&tenant_id=eq.{tenant_id}&select=*",
                headers=_get_supabase_headers(token),
                json=patch_payload,
            )
            res.raise_for_status()
            updated = res.json()
            if not updated:
                raise HTTPException(status_code=404, detail="Documento de compliance não encontrado.")
            return updated[0]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get(
    "/measurements/{measurement_id}/compliance-status",
    response_model=ComplianceCheckSummary,
    status_code=status.HTTP_200_OK,
    summary="Consultar Status de Regularidade e Trava Financeira",
    description="Retorna o diagnóstico de compliance da medição, indicando se a trava financeira está ativa ou liberada.",
)
async def check_measurement_compliance_status(
    measurement_id: UUID,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> ComplianceCheckSummary:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    async with httpx.AsyncClient(timeout=15.0) as client:
        doc_res = await client.get(
            f"{base_url}/rest/v1/compliance_documents",
            headers=_get_supabase_headers(token),
            params={"sub_measurement_id": f"eq.{measurement_id}", "tenant_id": f"eq.{tenant_id}"},
        )
        doc_res.raise_for_status()
        documents = doc_res.json()

        audit = SubcontractComplianceService.audit_measurement_compliance(documents)
        return ComplianceCheckSummary.model_validate(audit)


# ==============================================================================
# 4. REGRAS DE NEGÓCIO 1 E 2: APROVAÇÃO, TRAVA FINANCEIRA E RETENÇÃO FISCAL
# ==============================================================================

@router.post(
    "/measurements/{measurement_id}/approve",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Aprovar Medição, Executar Trava de Compliance e Gerar Contas a Pagar",
    description=(
        "Executa as duas regras de ouro: "
        "(1) Trava Financeira: Impede a aprovação e bloqueia o Contas a Pagar se faltar GFIP, CND ou FGTS verificados. "
        "(2) Retenção Fiscal: Cruza com as regras tributárias para abater INSS (11%) e ISS, gerando o Contas a Pagar líquido."
    ),
)
async def approve_sub_measurement(
    measurement_id: UUID,
    payload: SubMeasurementApprovalRequest,
    auth_data: Tuple[UUID, str] = Depends(get_current_tenant_and_token),
) -> Dict[str, Any]:
    tenant_id, token = auth_data
    base_url = settings.SUPABASE_URL.rstrip('/')

    async with httpx.AsyncClient(timeout=20.0) as client:
        # 1. Busca a medição
        meas_res = await client.get(
            f"{base_url}/rest/v1/sub_measurements",
            headers=_get_supabase_headers(token),
            params={"id": f"eq.{measurement_id}", "tenant_id": f"eq.{tenant_id}", "limit": "1"},
        )
        meas_res.raise_for_status()
        meas_records = meas_res.json()
        if not meas_records:
            raise HTTPException(status_code=404, detail="Medição de terceirizado não encontrada.")
        sub_measurement = meas_records[0]

        if sub_measurement.get("status") == SubMeasurementStatus.APPROVED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta medição já foi aprovada e possui lançamento financeiro gerado.",
            )

        # 2. Busca o subcontrato vinculado e o fornecedor
        subcontract_id = sub_measurement["subcontract_id"]
        sub_res = await client.get(
            f"{base_url}/rest/v1/subcontracts",
            headers=_get_supabase_headers(token),
            params={"id": f"eq.{subcontract_id}", "tenant_id": f"eq.{tenant_id}", "limit": "1"},
        )
        sub_res.raise_for_status()
        sub_records = sub_res.json()
        if not sub_records:
            raise HTTPException(status_code=404, detail="Subcontrato vinculado não encontrado.")
        subcontract = sub_records[0]

        supplier_id = subcontract["supplier_id"]
        supp_res = await client.get(
            f"{base_url}/rest/v1/suppliers",
            headers=_get_supabase_headers(token),
            params={"id": f"eq.{supplier_id}", "tenant_id": f"eq.{tenant_id}", "limit": "1"},
        )
        supp_res.raise_for_status()
        supp_records = supp_res.json()
        supplier = supp_records[0] if supp_records else {}
        supplier_tax_regime = supplier.get("tax_regime") or payload.supplier_tax_regime

        # 3. Busca todos os documentos de compliance anexados
        doc_res = await client.get(
            f"{base_url}/rest/v1/compliance_documents",
            headers=_get_supabase_headers(token),
            params={"sub_measurement_id": f"eq.{measurement_id}", "tenant_id": f"eq.{tenant_id}"},
        )
        doc_res.raise_for_status()
        documents = doc_res.json()

        # 4. EXECUTA AS REGRAS DE NEGÓCIO 1 E 2 VIA SERVICE
        # Se a auditoria de compliance falhar, dispara ComplianceBlockedException (HTTP 422) e interrompe
        try:
            compliance_plan = SubcontractComplianceService.enforce_compliance_and_prepare_financial_entry(
                subcontract=subcontract,
                sub_measurement=sub_measurement,
                documents=documents,
                supplier_tax_regime=supplier_tax_regime,
                custom_iss_rate=payload.custom_iss_rate,
                custom_inss_rate=payload.custom_inss_rate,
                due_date=payload.due_date,
                notes=payload.notes,
            )
        except ComplianceBlockedException:
            raise

        # 5. GRAVAÇÃO ATÔMICA 1: Geração do Contas a Pagar (financial_entries)
        financial_entry_payload = compliance_plan["financial_entry_payload"]
        fin_res = await client.post(
            f"{base_url}/rest/v1/financial_entries?select=*",
            headers=_get_supabase_headers(token),
            json=financial_entry_payload,
        )
        if not fin_res.is_success:
            logger.error("Falha ao gerar lançamento financeiro: %s", fin_res.text)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha ao gerar Contas a Pagar para a medição: {fin_res.text}",
            )
        financial_entry = fin_res.json()[0]

        # 6. GRAVAÇÃO ATÔMICA 2: Atualização do status da medição para 'approved' com as retenções abatidas
        withholdings = compliance_plan["withholdings"]
        meas_update_payload = {
            "status": SubMeasurementStatus.APPROVED.value,
            "financial_entry_id": financial_entry["id"],
            "compliance_checked_at": datetime.now().isoformat(),
            "technical_retention_amount": float(withholdings["technical_retention_amount"]),
            "inss_retention_amount": float(withholdings["inss_retention_amount"]),
            "iss_retention_amount": float(withholdings["iss_retention_amount"]),
            "tax_withholding_amount": float(withholdings["tax_withholding_amount"]),
            "net_payable_amount": float(withholdings["net_payable_amount"]),
        }

        meas_patch_res = await client.patch(
            f"{base_url}/rest/v1/sub_measurements?id=eq.{measurement_id}&tenant_id=eq.{tenant_id}&select=*",
            headers=_get_supabase_headers(token),
            json=meas_update_payload,
        )
        if not meas_patch_res.is_success:
            logger.error("Falha ao atualizar medição após financeiro: %s", meas_patch_res.text)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Medição aprovada no financeiro, mas erro ao atualizar status: {meas_patch_res.text}",
            )
        approved_measurement = meas_patch_res.json()[0]

        return {
            "success": True,
            "message": "Medição aprovada com sucesso com trava de compliance liberada e retenções fiscais calculadas.",
            "measurement": approved_measurement,
            "financial_entry": financial_entry,
            "tax_breakdown": {
                "measured_gross_value": float(withholdings["measured_value"]),
                "technical_retention_amount": float(withholdings["technical_retention_amount"]),
                "inss_retention_amount": float(withholdings["inss_retention_amount"]),
                "iss_retention_amount": float(withholdings["iss_retention_amount"]),
                "total_withholdings_deducted": float(withholdings["technical_retention_amount"] + withholdings["tax_withholding_amount"]),
                "net_payable_to_subcontractor": float(withholdings["net_payable_amount"]),
                "supplier_tax_regime": supplier_tax_regime or "LUCRO_PRESUMIDO",
                "bypass_fiscal_applied": (supplier_tax_regime or "").lower() == "mei",
            },
            "compliance_audit": compliance_plan["audit"],
        }
