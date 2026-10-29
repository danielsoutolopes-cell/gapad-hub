import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MaterialTransfersClient } from './transfers-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Portaria Digital & Logística de Canteiro | GADAP Hub',
  description: 'Controle de recebimento e retirada de materiais com assinatura digital em tela, fotos, geolocalização GPS e envio flexível via WhatsApp.',
};

interface PageProps {
  params: {
    id: string;
  };
}

export default async function MaterialTransfersPage({ params }: PageProps) {
  const projectId = params.id;
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;

  // 1. Buscar Informações da Obra
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, code, address_city, address_state')
    .eq('id', projectId)
    .maybeSingle();

  // 2. Buscar Histórico Recente de Transferências da Obra
  const { data: recentTransfers } = await supabase
    .from('material_transfers')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <MaterialTransfersClient
        projectId={projectId}
        projectName={project?.name || 'Obra em Andamento'}
        recentTransfers={recentTransfers || []}
      />
    </div>
  );
}
