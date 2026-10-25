import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
let pass = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    if (line.startsWith('SUPABASE_DB_PASSWORD=')) {
      pass = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
    }
  });
}

const client = new Client({
  host: 'db.dkjcgrwztyhcsyxlajia.supabase.co',
  port: 5432,
  user: 'postgres',
  password: pass,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  const res = await client.query("SELECT id, name, public FROM storage.buckets WHERE id = 'xml-fiscais';");
  if (res.rows.length === 0) {
    console.log("Criando bucket 'xml-fiscais'...");
    await client.query("INSERT INTO storage.buckets (id, name, public) VALUES ('xml-fiscais', 'xml-fiscais', true);");
    console.log("✓ Bucket 'xml-fiscais' criado com sucesso!");
  } else {
    console.log("✓ Bucket 'xml-fiscais' já existe:", res.rows[0]);
  }

  // Ensure public storage policies exist for reading xml-fiscais
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Access xml-fiscais' AND tablename = 'objects'
      ) THEN
        CREATE POLICY "Public Access xml-fiscais" ON storage.objects
          FOR SELECT USING (bucket_id = 'xml-fiscais');
      END IF;
    END $$;
  `);
  console.log("✓ Política de acesso ao bucket 'xml-fiscais' garantida!");

  await client.end();
}

main().catch(console.error);
