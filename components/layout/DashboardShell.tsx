'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardShellProps {
  children: React.ReactNode;
  tenantName?: string;
  isSuperAdmin?: boolean;
}

export function DashboardShell({
  children,
  tenantName = 'Empresa Teste',
  isSuperAdmin = false,
}: DashboardShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#090d16] text-slate-100">
      {/* 1. Sidebar Fixa à Esquerda com Scroll Independente */}
      <Sidebar
        tenantName={tenantName}
        isSuperAdmin={isSuperAdmin}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* 2. Conteúdo Principal à Direita (Header Fixo + Main com Scroll Independente) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          tenantName={tenantName}
          isSuperAdmin={isSuperAdmin}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
