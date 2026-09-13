// Teste direto do parser (sem Next.js)
import { readFileSync } from 'fs';

const html = readFileSync('C:/Users/MADISHAR/Downloads/debug-html-site-junho.html', 'utf-8');

console.log(`HTML: ${(html.length / 1024).toFixed(1)} KB`);

// Teste 1: Encontra tbody?
const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
console.log('\n1. Encontrou tbody?', !!tbodyMatch);

if (!tbodyMatch) {
  console.log('❌ Nenhum tbody encontrado');
  process.exit(1);
}

// Teste 2: Quantos tbody?
const allTbody = html.match(/<tbody[^>]*>/g);
console.log(`2. Total de <tbody> tags: ${allTbody?.length || 0}`);

// Teste 3: Qual tbody foi capturado?
const tbodyContent = tbodyMatch[1];
console.log(`3. Conteúdo do tbody capturado: ${(tbodyContent.length / 1024).toFixed(1)} KB`);

// Teste 4: Tem data-colname?
const hasDataColname = tbodyContent.includes('data-colname');
console.log(`4. Tem data-colname no tbody? ${hasDataColname}`);

// Teste 5: Encontra linhas TR?
const rows = Array.from(tbodyContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g));
console.log(`5. Total de linhas <tr>: ${rows.length}`);

if (rows.length === 0) {
  console.log('❌ Nenhuma linha TR encontrada');

  // Debug: mostra primeiros 1000 chars do tbody
  console.log('\nPrimeiros 1000 chars do tbody:');
  console.log(tbodyContent.substring(0, 1000));

  process.exit(1);
}

// Teste 6: Primeira linha tem data-colname?
const firstRow = rows[0][1];
console.log(`\n6. Primeira linha: ${firstRow.length} chars`);
const hasColname = firstRow.includes('data-colname');
console.log(`   Tem data-colname? ${hasColname}`);

// Teste 7: Extrai células
const tdMatches = Array.from(firstRow.matchAll(/<td[^>]*data-colname=["']([^"']+)["'][^>]*>([\s\S]*?)<\/td>/g));
console.log(`7. Células encontradas: ${tdMatches.length}`);

if (tdMatches.length > 0) {
  console.log('\n✅ Parser funcionando!');
  console.log('Primeira célula:', {
    colName: tdMatches[0][1],
    content: tdMatches[0][2].replace(/<[^>]+>/g, '').trim().substring(0, 50)
  });
} else {
  console.log('\n❌ Parser NÃO encontrou células');
  console.log('Primeiros 500 chars da primeira linha:');
  console.log(firstRow.substring(0, 500));
}
