import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface NormalizedCnpjData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  cnae_principal: string;
  cnae_codigo: string;
  email: string;
  telefone: string;
  responsavel_qsa: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  porte: string;
  natureza_juridica: string;
}

/**
 * Consulta pública de CNPJ na Receita Federal com múltiplos provedores em cascata:
 * 1. BrasilAPI (https://brasilapi.com.br/api/cnpj/v1/{cnpj})
 * 2. CNPJ.ws Pública (https://publica.cnpj.ws/cnpj/{cnpj})
 * 3. ReceitaWS (https://receitaws.com.br/v1/cnpj/{cnpj})
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { cnpj: string } }
) {
  const cleanCnpj = (params.cnpj || '').replace(/\D/g, '');

  if (cleanCnpj.length !== 14) {
    return NextResponse.json(
      { detail: 'CNPJ inválido. Informe exatamente 14 dígitos numéricos.' },
      { status: 400 }
    );
  }

  // 1. Tentativa Principal: BrasilAPI
  try {
    const brasilApiResp = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'GADAP-Hub-ERP/1.0',
        },
        cache: 'no-store',
      }
    );

    if (brasilApiResp.ok) {
      const data = await brasilApiResp.json();
      const firstPartner =
        Array.isArray(data.qsa) && data.qsa.length > 0
          ? data.qsa[0].nome_socio || ''
          : '';

      const rawPhone = data.ddd_telefone_1 || data.ddd_telefone_2 || '';
      const formattedPhone = formatPhoneBr(rawPhone);

      const logradouroCompleto = [
        data.descricao_tipo_de_logradouro,
        data.logradouro,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();

      const normalized: NormalizedCnpjData = {
        cnpj: cleanCnpj,
        razao_social: data.razao_social || '',
        nome_fantasia: data.nome_fantasia || data.razao_social || '',
        situacao_cadastral: data.descricao_situacao_cadastral || 'ATIVA',
        cnae_principal: data.cnae_fiscal_descricao || '',
        cnae_codigo: String(data.cnae_fiscal || ''),
        email: (data.email || '').toLowerCase(),
        telefone: formattedPhone,
        responsavel_qsa: firstPartner,
        cep: (data.cep || '').replace(/\D/g, ''),
        logradouro: logradouroCompleto || data.logradouro || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        municipio: data.municipio || '',
        uf: data.uf || '',
        porte: data.porte || '',
        natureza_juridica: data.natureza_juridica || '',
      };

      return NextResponse.json(normalized, { status: 200 });
    }
  } catch (err) {
    console.warn('BrasilAPI indisponível, acionando fallback CNPJ.ws...', err);
  }

  // 2. Fallback Secundário: CNPJ.ws Pública
  try {
    const cnpjWsResp = await fetch(
      `https://publica.cnpj.ws/cnpj/${cleanCnpj}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'GADAP-Hub-ERP/1.0',
        },
        cache: 'no-store',
      }
    );

    if (cnpjWsResp.ok) {
      const data = await cnpjWsResp.json();
      const estab = data.estabelecimento || {};
      const socios = Array.isArray(data.socios) ? data.socios : [];
      const firstPartner = socios.length > 0 ? socios[0].nome || '' : '';

      const ddd = estab.ddd1 || '';
      const tel = estab.telefone1 || '';
      const formattedPhone = formatPhoneBr(`${ddd}${tel}`);

      const logradouroCompleto = [estab.tipo_logradouro, estab.logradouro]
        .filter(Boolean)
        .join(' ')
        .trim();

      const normalized: NormalizedCnpjData = {
        cnpj: cleanCnpj,
        razao_social: data.razao_social || '',
        nome_fantasia: estab.nome_fantasia || data.razao_social || '',
        situacao_cadastral: estab.situacao_cadastral || 'Ativa',
        cnae_principal: estab.atividade_principal?.descricao || '',
        cnae_codigo: String(estab.atividade_principal?.id || ''),
        email: (estab.email || '').toLowerCase(),
        telefone: formattedPhone,
        responsavel_qsa: firstPartner,
        cep: (estab.cep || '').replace(/\D/g, ''),
        logradouro: logradouroCompleto,
        numero: estab.numero || '',
        complemento: estab.complemento || '',
        bairro: estab.bairro || '',
        municipio: estab.cidade?.nome || '',
        uf: estab.estado?.sigla || '',
        porte: data.porte?.descricao || '',
        natureza_juridica: data.natureza_juridica?.descricao || '',
      };

      return NextResponse.json(normalized, { status: 200 });
    }
  } catch (err) {
    console.warn('CNPJ.ws indisponível, acionando fallback ReceitaWS...', err);
  }

  // 3. Fallback Terciário: ReceitaWS
  try {
    const receitaWsResp = await fetch(
      `https://receitaws.com.br/v1/cnpj/${cleanCnpj}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'GADAP-Hub-ERP/1.0',
        },
        cache: 'no-store',
      }
    );

    if (receitaWsResp.ok) {
      const data = await receitaWsResp.json();
      if (data.status !== 'ERROR') {
        const firstPartner =
          Array.isArray(data.qsa) && data.qsa.length > 0
            ? data.qsa[0].nome || ''
            : '';

        const cnaeObj =
          Array.isArray(data.atividade_principal) &&
          data.atividade_principal.length > 0
            ? data.atividade_principal[0]
            : null;

        const normalized: NormalizedCnpjData = {
          cnpj: cleanCnpj,
          razao_social: data.nome || '',
          nome_fantasia: data.fantasia || data.nome || '',
          situacao_cadastral: data.situacao || 'ATIVA',
          cnae_principal: cnaeObj?.text || '',
          cnae_codigo: cnaeObj?.code || '',
          email: (data.email || '').toLowerCase(),
          telefone: data.telefone || '',
          responsavel_qsa: firstPartner,
          cep: (data.cep || '').replace(/\D/g, ''),
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          municipio: data.municipio || '',
          uf: data.uf || '',
          porte: data.porte || '',
          natureza_juridica: data.natureza_juridica || '',
        };

        return NextResponse.json(normalized, { status: 200 });
      }
    }
  } catch (err) {
    console.error('Todos os provedores de CNPJ falharam:', err);
  }

  return NextResponse.json(
    {
      detail:
        'Não foi possível localizar os dados deste CNPJ na Receita Federal no momento. Você pode preencher os campos manualmente.',
    },
    { status: 404 }
  );
}

function formatPhoneBr(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw.trim();
}

