// Screener mensal da B3: aplica os filtros de Buffett/Munger adaptados ao Brasil sobre todas as ações
// do Fundamentus e grava data/br-candidates.json. Também guarda um histórico mensal de P/L, ROE e ROIC
// (data/br-history.json), que vira a "média histórica" depois de 12 meses.
// Uso: node scripts/br-screen.mjs   (não precisa de chave)
import { readFile, writeFile } from 'node:fs/promises';
import { resultado, detalhes } from './fundamentus.mjs';

// ---------- Critérios (ajuste aqui) ----------
const CRITERIA = {
  minLiq2m: 2_000_000,   // liquidez média diária (R$) dos últimos 2 meses
  minRoe: 20,            // ROE atual, % (mais alto que nos EUA: o custo de capital no Brasil é maior)
  minRoic: 15,           // ROIC atual, %
  minNetMargin: 10,      // margem líquida, %
  maxDebtEquity: 1.0,    // dívida bruta / patrimônio
  minRevGrowth5: 5,      // crescimento da receita em 5 anos, % (nominal)
  maxPe: 60,
  // controle estatal: Munger insistia em incentivos alinhados
  stateControlled: ['PETR', 'BBAS', 'BBSE', 'CXSE', 'SAPR', 'CSMG', 'CMIG', 'BRSR', 'BNBR', 'BAZA', 'BEES', 'BGIP', 'CEEB', 'CEBR', 'CLSC', 'EMAE', 'BMEB', 'BSLI', 'BPAR'],
  excludedSectors: /petr[óo]leo|g[áa]s|minera|siderurgia|metalurgia|papel|celulose|qu[íi]mic|energia el[ée]trica|saneamento|explora[çc][ãa]o de im[óo]veis|constru[çc][ãa]o civil|incorpora|agropecu|agricultura|a[çc][úu]car|carnes|transporte a[ée]reo|autom[óo]veis|intermedi[áa]rios financeiros|bancos|securitizadora|holdings/i,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const root = (t) => t.slice(0, 4);
const month = new Date().toISOString().slice(0, 7);

const all = await resultado();
const { stocks } = JSON.parse(await readFile(new URL('../data/br-stocks.json', import.meta.url)));
const inMain = new Set(stocks.map((s) => root(s.ticker)));
console.log(`Fundamentus: ${Object.keys(all).length} papéis.`);

// uma classe por empresa: fica a mais líquida (ex.: ITUB4 em vez de ITUB3)
const best = {};
for (const x of Object.values(all)) {
  if (!(x.liq2m >= CRITERIA.minLiq2m)) continue;
  const r = root(x.ticker);
  if (!best[r] || x.liq2m > best[r].liq2m) best[r] = x;
}
const universe = Object.values(best);
console.log(`${universe.length} empresas com liquidez ≥ R$ ${CRITERIA.minLiq2m.toLocaleString('pt-BR')}/dia.`);

// histórico mensal (lista principal + todo o universo líquido) para montar médias ao longo do tempo
const histUrl = new URL('../data/br-history.json', import.meta.url);
let history = {};
try { history = JSON.parse(await readFile(histUrl)); } catch { /* primeira vez */ }
for (const x of universe) {
  const h = (history[x.ticker] ||= []);
  const point = { m: month, pe: x.pe, roe: x.roe, roic: x.roic };
  const i = h.findIndex((p) => p.m === month);
  if (i >= 0) h[i] = point; else h.push(point);
  if (h.length > 120) h.splice(0, h.length - 120); // guarda até 10 anos
}
await writeFile(histUrl, JSON.stringify(history) + '\n');

const avgPe = (t) => {
  const v = (history[t] || []).map((p) => p.pe).filter((x) => x > 0 && x < 100);
  return v.length >= 12 ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

const passed = universe.filter((x) =>
  !inMain.has(root(x.ticker)) && !CRITERIA.stateControlled.includes(root(x.ticker)) &&
  x.roe >= CRITERIA.minRoe && x.roic >= CRITERIA.minRoic && x.netMargin >= CRITERIA.minNetMargin &&
  x.de != null && x.de <= CRITERIA.maxDebtEquity && x.revGrowth5 >= CRITERIA.minRevGrowth5 &&
  x.pe > 0 && x.pe <= CRITERIA.maxPe);
console.log(`${passed.length} passaram nos filtros numéricos; checando setor de cada uma…`);

const candidates = [];
for (const x of passed) {
  let d = {};
  try { d = await detalhes(x.ticker); } catch (e) { console.warn(`detalhes ${x.ticker}: ${e.message}`); }
  await sleep(800);
  if (CRITERIA.excludedSectors.test(`${d.sector || ''} ${d.subsector || ''}`)) { console.log(`- ${x.ticker} excluída (${d.sector} / ${d.subsector})`); continue; }
  candidates.push({
    ticker: x.ticker, name: d.name || x.ticker, sector: d.sector || '', subIndustry: d.subsector || '', index: 'B3',
    founded: null, ipoYear: null, price: x.price, pe: x.pe, peHist: avgPe(x.ticker), eps: x.eps, epsNorm: null,
    // mesmos nomes de campo da versão americana; aqui são valores atuais (o Fundamentus não dá médias de 5 anos)
    roe5: x.roe, roic5: x.roic, netMargin5: x.netMargin, de: x.de, divYield: x.divYield,
    epsGrowth5: x.revGrowth5, epsDeclines: 0, negativeEquity: false, liq2m: x.liq2m,
  });
  console.log(`✓ ${x.ticker} (${d.sector} / ${d.subsector})`);
}

await writeFile(new URL('../data/br-candidates.json', import.meta.url), JSON.stringify({
  updatedAt: new Date().toISOString(), universeSize: Object.keys(all).length, scanned: universe.length,
  criteria: { ...CRITERIA, excludedSectors: CRITERIA.excludedSectors.source }, candidates,
}, null, 2) + '\n');
console.log(`Pronto: ${candidates.length} candidatas brasileiras.`);
