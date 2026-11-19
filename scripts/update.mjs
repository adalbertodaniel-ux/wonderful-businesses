// Busca preço e indicadores na Finnhub e grava data/live.json.
// Uso: FINNHUB_KEY=xxxx node scripts/update.mjs
import { readFile, writeFile } from 'node:fs/promises';

const KEY = process.env.FINNHUB_KEY;
if (!KEY) {
  console.error('Defina a variável FINNHUB_KEY (secret do repositório).');
  process.exit(1);
}

const { stocks } = JSON.parse(await readFile(new URL('../data/stocks.json', import.meta.url)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (path) => {
  const r = await fetch(`https://finnhub.io/api/v1/${path}&token=${KEY}`);
  if (!r.ok) throw new Error(`${r.status} em ${path}`);
  return r.json();
};

const quotes = {};
for (const s of stocks) {
  try {
    const [q, m] = await Promise.all([
      api(`quote?symbol=${s.ticker}`),
      api(`stock/metric?symbol=${s.ticker}&metric=all`),
    ]);
    const x = m.metric || {};
    quotes[s.ticker] = {
      price: q.c || null,
      changePct: q.dp ?? null,
      pe: x.peTTM ?? x.peBasicExclExtraTTM ?? null,
      eps: x.epsTTM ?? x.epsBasicExclExtraItemsTTM ?? null,
      roe: x.roeTTM ?? null,
      roic: x.roiTTM ?? null,
      netMargin: x.netProfitMarginTTM ?? null,
      divYield: x.currentDividendYieldTTM ?? x.dividendYieldIndicatedAnnual ?? null,
      de: x['totalDebt/totalEquityQuarterly'] ?? x['totalDebt/totalEquityAnnual'] ?? null,
      high52: x['52WeekHigh'] ?? null,
      low52: x['52WeekLow'] ?? null,
    };
    console.log(`ok ${s.ticker} ${quotes[s.ticker].price}`);
  } catch (e) {
    console.warn(`falhou ${s.ticker}: ${e.message}`);
  }
  await sleep(1100); // fica abaixo de 60 chamadas/min do plano grátis
}

await writeFile(
  new URL('../data/live.json', import.meta.url),
  JSON.stringify({ updatedAt: new Date().toISOString(), quotes }, null, 2) + '\n'
);
console.log(`Gravado data/live.json com ${Object.keys(quotes).length} ações.`);
