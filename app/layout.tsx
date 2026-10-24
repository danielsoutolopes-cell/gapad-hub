import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/providers/query-provider';

export const metadata: Metadata = {
  title: 'GADAP Hub - Gestão e Inteligência Fiscal para Obras e Serviços',
  description:
    'O ecossistema operacional e fiscal definitivo para a cadeia de construção civil leve e serviços técnicos no Brasil. Compliance tributário, controle de obras e automação.',
  keywords: [
    'ERP Construção Civil',
    'Inteligência Fiscal',
    'Medição de Obra',
    'Retenção Técnica',
    'NF-e',
    'NFS-e',
    'Supabase RLS',
  ],
  authors: [{ name: 'GADAP Hub Team' }],
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]" />
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_60%_60%_at_80%_60%,rgba(59,130,246,0.08),rgba(255,255,255,0))]" />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
