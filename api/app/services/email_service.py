import logging
import os
from typing import Optional, List

logger = logging.getLogger("gadap.email_service")

class EmailService:
    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY", "")
        self.sender = os.getenv("DEFAULT_FROM_EMAIL", "financeiro@gadap.com.br")

    async def send_invoice_billing_email(
        self,
        to_email: str,
        recipient_name: str,
        invoice_number: str,
        amount: float,
        due_date: str,
        pdf_url: Optional[str] = None,
        pix_code: Optional[str] = None
    ) -> bool:
        """
        Dispara e-mail transacional formatado com template HTML responsivo e logo do Tenant.
        Executado em background via FastAPI BackgroundTasks para não bloquear a resposta do usuário.
        """
        logger.info(f"Disparando e-mail transacional de cobrança para {to_email} (NF #{invoice_number}, R$ {amount:.2f})")
        
        # Template HTML renderizado
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; }}
            .card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }}
            .header {{ background: #0f172a; padding: 24px; color: #ffffff; text-align: center; }}
            .content {{ padding: 28px; color: #334155; line-height: 1.6; }}
            .amount-box {{ background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }}
            .amount {{ font-size: 28px; font-weight: 800; color: #059669; }}
            .btn {{ display: inline-block; background: #059669; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-top: 16px; }}
            .footer {{ background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }}
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h2 style="margin: 0; font-size: 20px;">GADAP Hub • Notificação de Cobrança</h2>
            </div>
            <div class="content">
              <p>Olá, <strong>{recipient_name}</strong>,</p>
              <p>Segue a emissão do título referente aos serviços prestados e faturamento da sua obra.</p>
              
              <div class="amount-box">
                <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600;">Valor a Pagar</div>
                <div class="amount">R$ {amount:,.2f}</div>
                <div style="font-size: 13px; color: #475569; margin-top: 4px;">Vencimento: <strong>{due_date}</strong> • Título #{invoice_number}</div>
              </div>

              {f'<p><strong>Código PIX Copia e Cola:</strong><br><code style="background: #e2e8f0; padding: 6px 10px; border-radius: 4px; font-size: 12px; word-break: break-all;">{pix_code}</code></p>' if pix_code else ''}
              
              {f'<div style="text-align: center;"><a href="{pdf_url}" class="btn">Visualizar Fatura / Boleto</a></div>' if pdf_url else ''}
            </div>
            <div class="footer">
              Enviado automaticamente pelo GADAP Hub Construção Civil • Todos os direitos reservados.
            </div>
          </div>
        </body>
        </html>
        """

        # Se houver chave do Resend configurada, chamamos a API externa. Caso contrário, registra sucesso em mock de log
        if self.api_key:
            import httpx
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                        json={
                            "from": self.sender,
                            "to": [to_email],
                            "subject": f"Fatura #{invoice_number} - Vencimento {due_date}",
                            "html": html_content
                        }
                    )
                    return resp.status_code in [200, 201]
            except Exception as e:
                logger.error(f"Erro ao disparar via Resend: {str(e)}")
                return False
        
        logger.info(f"E-mail simulado com sucesso para {to_email}")
        return True

email_service = EmailService()
