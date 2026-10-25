import React from 'react';
import { Metadata } from 'next';
import { BackofficeClient } from './backoffice-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Backoffice Master • GADAP Hub (God Mode)',
  description: 'Painel administrativo supremo de gestão de tenants, infraestrutura e governança do SaaS GADAP Hub.',
};

export default function BackofficePage() {
  return <BackofficeClient />;
}
