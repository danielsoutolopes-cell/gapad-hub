import { PortalResumoClient } from './portal-resumo-client';

export const dynamic = 'force-dynamic';

export default function PortalResumoPage({
  params,
}: {
  params: { id: string };
}) {
  return <PortalResumoClient projectId={params.id} />;
}

