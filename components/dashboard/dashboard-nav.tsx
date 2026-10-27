'use client';

import React from 'react';

interface DashboardNavProps {
  tenantName?: string;
  isSuperAdmin?: boolean;
}

/**
 * DashboardNav legado mantido para compatibilidade reversa.
 * A navegação global foi promovida para os componentes arquiteturais
 * Sidebar + Header dentro de app/dashboard/layout.tsx.
 */
export function DashboardNav({ tenantName, isSuperAdmin }: DashboardNavProps) {
  return null;
}
