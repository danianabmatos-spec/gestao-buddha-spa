// Testa regex de extração do total
import { readFileSync } from 'fs';

const html = readFileSync('C:/Users/MADISHAR/Downloads/debug-html-site-junho.html', 'utf-8');

console.log('=== TESTE REGEX TOTAL REEMBOLSO ===\n');

// Regex 1 (atual)
const regex1 = /R\$\s*([\d.,]+)\s*<\/div>\s*[\s\S]{0,100}Reembolso/;
const match1 = html.match(regex1);
console.log('Regex 1:', regex1);
console.log('Match:', match1?.[0].substring(0, 200));
console.log('Valor extraído:', match1?.[1]);
console.log('');

// Regex 2 (alternativa)
const regex2 = /Reembolso[\s\S]{0,50}R\$\s*([\d.,]+)/;
const match2 = html.match(regex2);
console.log('Regex 2:', regex2);
console.log('Match:', match2?.[0]);
console.log('Valor extraído:', match2?.[1]);
console.log('');

// Regex 3 (nova - mais específica)
const regex3 = /<span>R\$\s*([\d.,]+)<\/span><\/h5>\s*<div[^>]*>Reembolso/;
const match3 = html.match(regex3);
console.log('Regex 3 (nova):', regex3);
console.log('Match:', match3?.[0]);
console.log('Valor extraído:', match3?.[1]);
console.log('');

// Procura manual
const idx = html.indexOf('Reembolso');
if (idx > 0) {
  console.log('Contexto ao redor de "Reembolso":');
  console.log(html.substring(idx - 200, idx + 50));
}
