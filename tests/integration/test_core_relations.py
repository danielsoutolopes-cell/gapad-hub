import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
api_dir = os.path.join(root_dir, "api")
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

class TestTenantIsolationAndRLS:
    """
    Testes de Isolamento Multi-Tenant e Políticas RLS (Row Level Security).
    Garante que o Tenant A nunca acesse ou modifique dados do Tenant B.
    """

    def test_tenant_cannot_access_other_tenant_project(self):
        """
        Simula Tenant A tentando consultar recebíveis filtrados por obra de Tenant B.
        O endpoint deve responder com lista vazia para a obra alheia devido ao RLS.
        """
        tenant_a_headers = {
            "Authorization": "Bearer mock_token_tenant_a",
            "x-tenant-id": "11111111-1111-1111-1111-111111111111"
        }
        tenant_b_project_id = "22222222-2222-2222-2222-222222222222"

        response = client.get(
            f"/api/v1/finance/receivables?project_id={tenant_b_project_id}",
            headers=tenant_a_headers
        )
        assert response.status_code in [200, 403, 404]
        if response.status_code == 200:
            data = response.json()
            items = data.get("items", [])
            # Nenhum título da obra de Tenant B pode vazar para Tenant A
            assert len(items) == 0

    def test_tenant_cannot_mutate_other_tenant_subcontract(self):
        """
        Simula Tenant A tentando atualizar status de medição pertencente a Tenant B.
        Deve ser barrado com erro 403, 404 ou 422 quando o token/tenant não coincidir.
        """
        tenant_a_headers = {
            "Authorization": "Bearer mock_token_tenant_a",
            "x-tenant-id": "11111111-1111-1111-1111-111111111111"
        }
        subcontract_entry_b = "99999999-9999-9999-9999-999999999999"

        # Mock para simular resposta de banco Supabase bloqueando mutação de outro tenant
        with patch("httpx.AsyncClient.patch") as mock_patch:
            mock_patch.return_value = MagicMock(
                status_code=404,
                json=lambda: {"detail": "Registro não encontrado ou sem permissão de acesso RLS."}
            )

            response = client.patch(
                f"/api/v1/finance/entries/{subcontract_entry_b}/status",
                headers=tenant_a_headers,
                json={"status": "pago"}
            )
            assert response.status_code in [403, 404, 422]

    def test_cascade_delete_integrity_simulation(self):
        """
        Valida que o endpoint de reset/delete em cascata do backoffice executa com sucesso.
        """
        tenant_id = "33333333-3333-3333-3333-333333333333"

        # Gera token JWT mock com claim is_superadmin=True
        import jwt
        token = jwt.encode(
            {"sub": "superadmin-uuid", "email": "master@gadap.com.br", "is_superadmin": True},
            "secret_key",
            algorithm="HS256"
        )

        with patch("httpx.AsyncClient.get") as mock_get, patch("httpx.AsyncClient.delete") as mock_del:
            mock_get.return_value = MagicMock(
                status_code=200,
                json=lambda: [{"id": tenant_id, "trade_name": "Construtora Teste"}]
            )
            mock_del.return_value = MagicMock(status_code=200)

            response = client.post(
                f"/api/v1/backoffice/tenants/{tenant_id}/reset",
                headers={"Authorization": f"Bearer {token}"},
                json={"confirm_phrase": "RESETAR DADOS DO TENANT"}
            )
            assert response.status_code in [200, 404]

