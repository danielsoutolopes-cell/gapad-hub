import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const targetFile = path.join(rootDir, 'GADAP_HUB_Onboarding_e_Guia_Rapido.md');

console.log('=' .repeat(70));
console.log(' GADAP-ERP • Verificador e Gerador de Documentação de Onboarding');
console.log('=' .repeat(70));

if (fs.existsSync(targetFile)) {
  const stats = fs.statSync(targetFile);
  console.log(`[OK] Arquivo verificado: ${targetFile} (${stats.size} bytes)`);
} else {
  console.error(`[ERRO] Arquivo não encontrado: ${targetFile}`);
  process.exit(1);
}
