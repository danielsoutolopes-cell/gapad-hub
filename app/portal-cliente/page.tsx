import React from 'react';
import { redirect } from 'next/navigation';

export default function PortalIndexPage() {
  // Redireciona para o ID de exemplo da obra principal
  redirect('/portal-cliente/a1111111-1111-1111-1111-111111111111/resumo');
}

