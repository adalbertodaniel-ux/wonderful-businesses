// Move uma candidata do screener para a lista principal (data/stocks.json).
// Uso: node scripts/approve.mjs TICKER [TICKER...]
import { readFile, writeFile } from 'node:fs/promises';

const tickers = process.argv.slice(2).join(' ').toUpperCase().split(/[\s,;]+/).filter(Boolean);
if (!tickers.length) { console.error('Informe pelo menos um ticker.'); process.exit(1); }

const stocksUrl = new URL('../data/stocks.json', import.meta.url);
const candUrl = new URL('../data/candidates.json', import.meta.url);
const base = JSON.parse(await readFile(stocksUrl));
const cand = JSON.parse(await readFile(candUrl));

// mesmo g conservador usado no dashboard: 70% do crescimento de LPA de 5 anos, entre 3% e 10%
const gOf = (c) => Math.min(0.10, Math.max(0.03, Math.round(0.7 * (c.epsGrowth5 ?? 5)) / 100));
const today = new Date().toISOString().slice(0, 10);
let added = 0;

for (const t of tickers) {
  if (base.stocks.some((s) => s.ticker === t)) { console.log(`${t} já está na lista.`); continue; }
  const c = cand.candidates.find((x) => x.ticker === t);
  if (!c) { console.error(`${t} não está entre as candidatas.`); process.exitCode = 1; continue; }
  const depressed = c.epsNorm && c.eps < 0.6 * c.epsNorm;
  const eps = depressed ? c.epsNorm : c.eps;
  base.stocks.push({
    ticker: c.ticker, name: c.name, sector: c.subIndustry || c.sector,
    founded: c.founded || c.ipoYear || new Date().getFullYear(), berkshire: false,
    price: c.price, pe: depressed ? Math.round(c.price / eps * 10) / 10 : c.pe, peHist: c.peHist ? Math.round(c.peHist * 10) / 10 : null,
    roe: c.roe5, roic: c.roic5, netMargin: c.netMargin5, de: c.de, divYield: c.divYield,
    g: gOf(c), epsBase: Math.round(eps * 100) / 100, staticEps: depressed,
    moat: 'A avaliar: descreva aqui a vantagem competitiva durável.',
    note: `Entrou pelo screener em ${today}.${depressed ? ' Lucro dos últimos 12 meses deprimido por itens pontuais: usa o LPA médio de 3 anos (fixo).' : ''}${c.founded ? '' : ' Ano de fundação = ano do IPO; confira.'}`,
  });
  cand.candidates = cand.candidates.filter((x) => x.ticker !== t);
  console.log(`${t} adicionada à lista principal.`);
  added++;
}

if (added) {
  await writeFile(stocksUrl, JSON.stringify(base, null, 2) + '\n');
  await writeFile(candUrl, JSON.stringify(cand, null, 2) + '\n');
}
