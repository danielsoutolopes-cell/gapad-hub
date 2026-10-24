import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Carrega variáveis do arquivo .env.local se existirem
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...values] = trimmed.split('=');
      const val = values.join('=').replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

const dbPassword = process.env.SUPABASE_DB_PASSWORD;
if (!dbPassword) {
  console.error('SUPABASE_DB_PASSWORD não definida no .env.local');
  process.exit(1);
}

const client = new Client({
  host: 'db.dkjcgrwztyhcsyxlajia.supabase.co',
  port: 5432,
  user: 'postgres',
  password: dbPassword,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await client.connect();
    console.log('Conectado ao PostgreSQL do Supabase com sucesso.');

    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261024000001_suppliers_products_services.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('Aplicando migração 20261024000001_suppliers_products_services.sql...');
    await client.query(sql);
    console.log('✓ Migração executada com sucesso!');

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('suppliers', 'products', 'services')
      ORDER BY table_name;
    `);

    console.log('✓ Tabelas verificadas no schema public:', res.rows.map((r) => r.table_name));

    // Testa a geração de UUIDv7
    const uuidRes = await client.query('SELECT public.gen_uuid_v7() AS uuid7');
    console.log('✓ Teste da função gen_uuid_v7():', uuidRes.rows[0].uuid7);

    // Notifica o PostgREST para recarregar o schema cache
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('✓ Schema cache do PostgREST recarregado!');

    await client.end();
  } catch (err) {
    console.error('Erro na migração:', err);
    process.exit(1);
  }
}

run();
