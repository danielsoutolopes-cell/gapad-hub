'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { logout } from '@/app/actions/auth';

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

  // Auto-logoff compulsório à meia-noite (00:00) para ambiente de demonstração
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    const timer = setTimeout(() => {
      logout().catch(() => null);
    }, msUntilMidnight);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-slate-950 text-slate-100">
      {/* 1. Sidebar Fixa à Esquerda (bg-slate-900 + border-slate-800) */}
      <Sidebar
        tenantName={tenantName}
        isSuperAdmin={isSuperAdmin}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* 2. Conteúdo Principal à Direita (Header + Main em bg-slate-950) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-950">
        <Header
          tenantName={tenantName}
          isSuperAdmin={isSuperAdmin}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto bg-slate-950 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
