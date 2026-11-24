// Move candidatas do screener para a lista principal (EUA ou Brasil, detectado pelo ticker).
// Uso: node scripts/approve.mjs TICKER [TICKER...]
import { readFile, writeFile } from 'node:fs/promises';

const tickers = process.argv.slice(2).join(' ').toUpperCase().split(/[\s,;]+/).filter(Boolean);
if (!tickers.length) { console.error('Informe pelo menos um ticker.'); process.exit(1); }

const MARKETS = {
  us: {
    stocks: new URL('../data/stocks.json', import.meta.url), cand: new URL('../data/candidates.json', import.meta.url),
    // 70% do crescimento de LPA de 5 anos, entre 3% e 10%
    g: (c) => Math.min(0.10, Math.max(0.03, Math.round(0.7 * (c.epsGrowth5 ?? 5)) / 100)),
  },
  br: {
    stocks: new URL('../data/br-stocks.json', import.meta.url), cand: new URL('../data/br-candidates.json', import.meta.url),
    // 60% do crescimento de receita de 5 anos (nominal, em reais), entre 5% e 12%
    g: (c) => Math.min(0.12, Math.max(0.05, Math.round(0.6 * (c.epsGrowth5 ?? 8)) / 100)),
  },
};

const load = async (u) => { try { return JSON.parse(await readFile(u)); } catch { return null; } };
const data = {};
for (const [k, m] of Object.entries(MARKETS)) data[k] = { base: await load(m.stocks), cand: await load(m.cand), changed: false };

const today = new Date().toISOString().slice(0, 10);

for (const t of tickers) {
  const mk = Object.keys(MARKETS).find((k) => data[k].cand?.candidates?.some((x) => x.ticker === t));
  if (!mk) {
    const already = Object.keys(MARKETS).some((k) => data[k].base?.stocks?.some((s) => s.ticker === t));
    if (already) console.log(`${t} já está na lista principal.`);
    else { console.error(`${t} não está entre as candidatas.`); process.exitCode = 1; }
    continue;
  }
  const d = data[mk], m = MARKETS[mk];
  const c = d.cand.candidates.find((x) => x.ticker === t);
  const depressed = c.epsNorm && c.eps < 0.6 * c.epsNorm;
  const eps = depressed ? c.epsNorm : c.eps;
  d.base.stocks.push({
    ticker: c.ticker, name: c.name, sector: c.subIndustry || c.sector,
    founded: c.founded || c.ipoYear || null, berkshire: false, bank: false,
    price: c.price, pe: depressed ? Math.round(c.price / eps * 10) / 10 : c.pe,
    peHist: c.peHist ? Math.round(c.peHist * 10) / 10 : null,
    roe: c.roe5, roic: c.roic5, netMargin: c.netMargin5, de: c.de, divYield: c.divYield,
    g: m.g(c), epsBase: Math.round(eps * 100) / 100, staticEps: !!depressed,
    moat: 'A avaliar: descreva aqui a vantagem competitiva durável.',
    note: `Entrou pelo screener em ${today}.${depressed ? ' Lucro dos últimos 12 meses deprimido por itens pontuais: usa o LPA médio de 3 anos (fixo).' : ''}${c.founded ? '' : ' Ano de fundação a confirmar.'}`,
  });
  d.cand.candidates = d.cand.candidates.filter((x) => x.ticker !== t);
  d.changed = true;
  console.log(`${t} adicionada à lista principal (${mk === 'br' ? 'Brasil' : 'EUA'}).`);
}

for (const [k, d] of Object.entries(data)) {
  if (!d.changed) continue;
  await writeFile(MARKETS[k].stocks, JSON.stringify(d.base, null, 2) + '\n');
  await writeFile(MARKETS[k].cand, JSON.stringify(d.cand, null, 2) + '\n');
}
