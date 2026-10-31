import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ detail: 'Não autenticado.' }, { status: 401 });
    }

    const tenantId =
      user.app_metadata?.tenant_id ||
      user.user_metadata?.tenant_id ||
      request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        {
          cert_status: 'MISSING',
          cert_expiration: null,
          formatted_expiration: null,
          is_valid: false,
        },
        { status: 200 }
      );
    }

    const { data: company, error } = await supabase
      .from('companies')
      .select('id, trade_name, legal_name, cnpj, cert_expiration, cert_status')
      .eq('id', tenantId)
      .maybeSingle();

    if (error || !company) {
      return NextResponse.json(
        {
          tenant_id: tenantId,
          cert_status: 'MISSING',
          cert_expiration: null,
          formatted_expiration: null,
          is_valid: false,
        },
        { status: 200 }
      );
    }

    let certStatus = String(company.cert_status || 'MISSING').toUpperCase();
    let formattedExpiration: string | null = null;
    let isValid = false;

    if (company.cert_expiration) {
      const expDate = new Date(company.cert_expiration);
      if (!Number.isNaN(expDate.getTime())) {
        formattedExpiration = expDate.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: 'UTC',
        });
        if (expDate.getTime() > Date.now() && certStatus !== 'MISSING') {
          certStatus = 'VALID';
          isValid = true;
        } else {
          certStatus = 'EXPIRED';
          isValid = false;
        }
      }
    }

    return NextResponse.json({
      tenant_id: tenantId,
      company_name: company.trade_name || company.legal_name,
      cnpj: company.cnpj,
      cert_status: certStatus,
      cert_expiration: company.cert_expiration,
      formatted_expiration: formattedExpiration,
      is_valid: isValid,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno ao consultar certificado';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

