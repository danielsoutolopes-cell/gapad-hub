import React from 'react';
import AuditoriaClient from './auditoria-client';

export const metadata = {
  title: 'Trilha de Auditoria & Governança | GADAP Hub',
  description: 'Registro imutável de todas as mutações e ações administrativas no sistema'
};

export default function AuditoriaPage() {
  return <AuditoriaClient />;
}
