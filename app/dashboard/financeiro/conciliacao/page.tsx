import React from 'react';
import ConciliacaoClient from './conciliacao-client';

export const metadata = {
  title: 'Conciliação Bancária Híbrida | GADAP Hub',
  description: 'Conciliação Automática D+0 via Pluggy Open Finance e Importação OFX Zero-Cost com Auto-Match'
};

export default function ConciliacaoPage() {
  return <ConciliacaoClient />;
}
