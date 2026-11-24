// Atualiza preço e indicadores das ações brasileiras da lista principal (fonte: Fundamentus).
// Uso: node scripts/br-update.mjs   (não precisa de chave)
import { readFile, writeFile } from 'node:fs/promises';
import { resultado } from './fundamentus.mjs';

const { stocks } = JSON.parse(await readFile(new URL('../data/br-stocks.json', import.meta.url)));
const all = await resultado();

const quotes = {};
for (const s of stocks) {
  const x = all[s.ticker];
  if (!x) { console.warn(`não encontrei ${s.ticker} no Fundamentus`); continue; }
  quotes[s.ticker] = {
    price: x.price, changePct: null, pe: x.pe, eps: x.eps, roe: x.roe, roic: x.roic,
    netMargin: x.netMargin, divYield: x.divYield, de: x.de, revGrowth5: x.revGrowth5,
  };
  console.log(`ok ${s.ticker} R$ ${x.price} P/L ${x.pe}`);
}

await writeFile(new URL('../data/br-live.json', import.meta.url),
  JSON.stringify({ updatedAt: new Date().toISOString(), source: 'Fundamentus', quotes }, null, 2) + '\n');
console.log(`Gravado data/br-live.json com ${Object.keys(quotes).length} ações.`);
