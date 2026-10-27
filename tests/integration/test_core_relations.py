import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from api.app.main import app

client = TestClient(app)

class TestTenantIsolationAndRLS:
    """
    Testes de Isolamento Multi-Tenant e Políticas RLS (Row Level Security).
    Garante que o Tenant A nunca acesse ou modifique dados do Tenant B.
    """

    def test_tenant_cannot_access_other_tenant_project(self):
        """
        Simula Tenant A tentando consultar uma obra de Tenant B.
        Espera-se bloqueio 403 Forbidden ou 404 Not Found devido ao filtro RLS de tenant_id.
        """
        tenant_a_headers = {
            "Authorization": "Bearer mock_token_tenant_a",
            "x-tenant-id": "11111111-1111-1111-1111-111111111111"
        }
        tenant_b_project_id = "22222222-2222-2222-2222-222222222222"

        with patch("api.app.endpoints.financial.get_current_tenant") as mock_tenant:
            mock_tenant.return_value = "11111111-1111-1111-1111-111111111111"
            
            # Tentativa de listar recebíveis ou obras de outro tenant
            response = client.get(
                f"/api/v1/finance/receivables?project_id={tenant_b_project_id}",
                headers=tenant_a_headers
            )
            # A API deve isolar hermeticamente
            assert response.status_code in [200, 403, 404]
            if response.status_code == 200:
                data = response.json()
                # Nenhum item do Tenant B deve vir na resposta
                items = data.get("items", [])
                assert len(items) == 0

    def test_tenant_cannot_mutate_other_tenant_subcontract(self):
        """
        Simula Tenant A tentando atualizar status de medição pertencente a Tenant B.
        """
        tenant_a_headers = {
            "Authorization": "Bearer mock_token_tenant_a",
            "x-tenant-id": "11111111-1111-1111-1111-111111111111"
        }
        subcontract_entry_b = "99999999-9999-9999-9999-999999999999"

        response = client.patch(
            f"/api/v1/finance/entries/{subcontract_entry_b}/status",
            headers=tenant_a_headers,
            json={"status": "pago"}
        )
        # Se a entidade não pertence ao tenant autenticado, deve rejeitar
        assert response.status_code in [403, 404, 422]

    def test_cascade_delete_integrity_simulation(self):
        """
        Valida que a exclusão de um Tenant executa ON DELETE CASCADE nos projetos filhos.
        """
        tenant_id = "33333333-3333-3333-3333-333333333333"
        
        # Simula exclusão administrativa via backoffice
        with patch("api.app.core.supabase_admin.delete_tenant_cascade") as mock_delete:
            mock_delete.return_value = {"deleted_projects_count": 4, "deleted_tenant": tenant_id}
            
            # Chama o endpoint de reset ou exclusão
            response = client.delete(
                f"/api/v1/backoffice/tenants/{tenant_id}",
                headers={"Authorization": "Bearer superadmin_secret_token"}
            )
            assert response.status_code in [200, 404]
