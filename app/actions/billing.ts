'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

/**
 * Server Action: Renovar Benefício Comercial PLG (Prorrogação de 6 meses com 50% OFF)
 * Executa a stored procedure segura PostgreSQL public.renew_company_benefit
 */
export async function renewCompanyBenefitAction(): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: 'Sessão expirada. Faça login novamente para renovar o benefício.',
      };
    }

    const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
    if (!tenantId) {
      return {
        success: false,
        error: 'Tenant ID não identificado para o usuário autenticado.',
      };
    }

    // Chama a RPC no PostgreSQL
    const { data, error } = await supabase.rpc('renew_company_benefit', {
      p_company_id: tenantId,
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Erro ao processar renovação de benefício.',
      };
    }

    if (data && data.success === false) {
      return {
        success: false,
        error: data.error || 'Não foi possível prorrogar o benefício.',
      };
    }

    revalidatePath('/dashboard/configuracoes/faturamento');
    revalidatePath('/onboarding/planos');

    return {
      success: true,
      message: data.message || 'Benefício de 50% prorrogado por mais 6 meses com sucesso!',
      data,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Falha inesperada no servidor.';
    return {
      success: false,
      error: errMsg,
    };
  }
}
