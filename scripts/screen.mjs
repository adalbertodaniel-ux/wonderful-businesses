// Screener mensal: varre S&P 500 + S&P 400, aplica os filtros numéricos de Buffett/Munger
// e grava as empresas aprovadas em data/candidates.json.
// Uso: FINNHUB_KEY=xxxx node scripts/screen.mjs
import { readFile, writeFile } from 'node:fs/promises';

const KEY = process.env.FINNHUB_KEY;
if (!KEY) { console.error('Defina FINNHUB_KEY.'); process.exit(1); }

// ---------- Critérios (ajuste aqui) ----------
const CRITERIA = {
  minRoe5y: 15,          // ROE médio de 5 anos, %
  minRoic5y: 15,         // ROIC médio de 5 anos, %
  minNetMargin5y: 15,    // margem líquida média de 5 anos, %
  maxDebtEquity: 1.5,    // dívida/PL (PL negativo vai como alerta, não exclui)
  maxEpsDeclines: 2,     // anos com queda de LPA nos últimos 6
  requirePositiveEps: true,
  excludedSectors: ['Energy', 'Utilities', 'Real Estate', 'Materials'],
  excludedSubIndustry: /bank|airline|automobile manufacturer|steel|oil|gas|mining|coal|reinsurance|homebuild/i,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Universo ----------
function parseCsv(text) {
  const rows = [];
  for (const line of text.trim().split('\n')) {
    const cells = []; let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur.replace(/\r$/, ''));
    rows.push(cells);
  }
  return rows;
}

async function sp500() {
  const r = await fetch('https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv');
  const [head, ...rows] = parseCsv(await r.text());
  const i = (n) => head.indexOf(n);
  return rows.map((c) => ({
    ticker: c[i('Symbol')], name: c[i('Security')], sector: c[i('GICS Sector')],
    subIndustry: c[i('GICS Sub-Industry')], founded: parseInt(c[i('Founded')]) || null, index: 'S&P 500',
  }));
}

async function sp400() {
  const r = await fetch('https://en.wikipedia.org/wiki/List_of_S%26P_400_companies', {
    headers: { 'User-Agent': 'wonderful-businesses-screener/1.0 (GitHub Actions)' },
  });
  const html = await r.text();
  const table = html.match(/<table[^>]*id="constituents"[\s\S]*?<\/table>/)?.[0] || html.match(/<table[^>]*wikitable[\s\S]*?<\/table>/)?.[0];
  if (!table) throw new Error('tabela do S&P 400 não encontrada');
  const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#160;|&nbsp;/g, ' ').trim();
  const headers = [...(table.match(/<tr[\s\S]*?<\/tr>/)?.[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g) || [])].map((m) => strip(m[1]).toLowerCase());
  const col = (re, d) => { const k = headers.findIndex((h) => re.test(h)); return k >= 0 ? k : d; };
  const cSym = col(/symbol|ticker/, 0), cName = col(/security|company/, 1), cSec = col(/gics sector|sector/, 2), cSub = col(/sub-industry|industry/, 3);
  const out = [];
  for (const tr of table.match(/<tr[\s\S]*?<\/tr>/g).slice(1)) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]));
    if (cells.length < 3) continue;
    out.push({ ticker: cells[cSym], name: cells[cName], sector: cells[cSec], subIndustry: cells[cSub] || '', founded: null, index: 'S&P 400' });
  }
  return out;
}

const universe = [];
for (const [label, fn] of [['S&P 500', sp500], ['S&P 400', sp400]]) {
  try { const l = await fn(); universe.push(...l); console.log(`${label}: ${l.length} empresas`); }
  catch (e) { console.warn(`Não consegui baixar ${label}: ${e.message}`); }
}
if (!universe.length) { console.error('Universo vazio, abortando.'); process.exit(1); }

const { stocks } = JSON.parse(await readFile(new URL('../data/stocks.json', import.meta.url)));
const inMain = new Set(stocks.map((s) => s.ticker));

// Nome normalizado, para não contar duas classes de ação da mesma empresa (GOOG/GOOGL, FOX/FOXA, NWS/NWSA...)
const norm = (n) => (n || '').toLowerCase()
  .replace(/\(.*?\)/g, ' ').replace(/\bclass [a-z]\b|\bseries [a-z]\b/g, ' ')
  .replace(/[.,'’&-]/g, ' ').replace(/\b(inc|corp|corporation|co|company|plc|ltd|holdings?|group|the)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const mainNames = stocks.map((s) => norm(s.name)).filter(Boolean);
const sameAsMain = (n) => mainNames.some((m) => n === m || n.startsWith(m + ' '));

const seen = new Set(), seenNames = new Set();
const toScan = universe.filter((u) => {
  u.ticker = u.ticker.replace('.', '-').trim(); // BRK.B -> BRK-B
  if (!u.ticker || seen.has(u.ticker) || inMain.has(u.ticker)) return false;
  seen.add(u.ticker);
  const n = norm(u.name);
  if (n && (seenNames.has(n) || sameAsMain(n))) return false; // outra classe da mesma empresa
  seenNames.add(n);
  if (CRITERIA.excludedSectors.includes(u.sector)) return false;
  if (CRITERIA.excludedSubIndustry.test(u.subIndustry)) return false;
  return true;
});
console.log(`Varrendo ${toScan.length} empresas (após excluir setores de commodity e as que já estão na lista).`);

// ---------- Finnhub ----------
async function api(path, tries = 3) {
  for (let t = 0; t < tries; t++) {
    const r = await fetch(`https://finnhub.io/api/v1/${path}&token=${KEY}`);
    if (r.status === 429) { await sleep(5000 * (t + 1)); continue; }
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  }
  throw new Error('limite de requisições');
}

const last = (arr, n) => (arr || []).slice().sort((a, b) => b.period.localeCompare(a.period)).slice(0, n);
const avg = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

const candidates = [];
let scanned = 0;
for (const u of toScan) {
  try {
    const m = await api(`stock/metric?symbol=${u.ticker}&metric=all`);
    scanned++;
    const x = m.metric || {}, sa = m.series?.annual || {};
    const roe5 = x.roe5Y ?? null, roic5 = x.roi5Y ?? null, nm5 = x.netProfitMargin5Y ?? null;
    const de = x['totalDebt/totalEquityAnnual'] ?? x['totalDebt/totalEquityQuarterly'] ?? null;
    const eps = x.epsTTM ?? x.epsBasicExclExtraItemsTTM ?? null;
    const epsSeries = last(sa.eps, 6).reverse().map((p) => p.v);
    const declines = epsSeries.slice(1).filter((v, i) => v < epsSeries[i]).length;
    const negEps = epsSeries.some((v) => v <= 0);
    const peSeries = last(sa.pe, 5).map((p) => p.v).filter((v) => v > 0 && v < 200);
    const eps3 = last(sa.eps, 3).map((p) => p.v).filter((v) => v > 0);
    const epsNorm = eps3.length === 3 ? avg(eps3) : null; // LPA médio dos 3 últimos anos fiscais

    const fails = [];
    if (roe5 == null || roe5 < CRITERIA.minRoe5y) fails.push('ROE');
    if (roic5 == null || roic5 < CRITERIA.minRoic5y) fails.push('ROIC');
    if (nm5 == null || nm5 < CRITERIA.minNetMargin5y) fails.push('margem');
    if (de != null && de > CRITERIA.maxDebtEquity) fails.push('dívida');
    if (CRITERIA.requirePositiveEps && (!(eps > 0) || negEps)) fails.push('prejuízo');
    if (declines > CRITERIA.maxEpsDeclines) fails.push('LPA instável');

    if (!fails.length) {
      const p = await api(`stock/profile2?symbol=${u.ticker}`);
      const q = await api(`quote?symbol=${u.ticker}`);
      candidates.push({
        ticker: u.ticker, name: p.name || u.name, sector: u.sector, subIndustry: u.subIndustry, index: u.index,
        founded: u.founded, ipoYear: p.ipo ? parseInt(p.ipo) : null, marketCapB: p.marketCapitalization ? p.marketCapitalization / 1000 : null,
        price: q.c || null, pe: x.peTTM ?? null, peHist: peSeries.length >= 3 ? avg(peSeries) : null, eps, epsNorm,
        roe5, roic5, netMargin5: nm5, grossMargin5: x.grossMargin5Y ?? null, de,
        divYield: x.currentDividendYieldTTM ?? x.dividendYieldIndicatedAnnual ?? null,
        epsGrowth5: x.epsGrowth5Y ?? null, epsDeclines: declines, negativeEquity: de != null && de < 0,
      });
      console.log(`✓ ${u.ticker} passou`);
    }
  } catch (e) {
    console.warn(`falhou ${u.ticker}: ${e.message}`);
  }
  await sleep(Number(process.env.SCREEN_DELAY_MS ?? 1050)); // abaixo de 60 chamadas/min
}

await writeFile(new URL('../data/candidates.json', import.meta.url), JSON.stringify({
  updatedAt: new Date().toISOString(), universeSize: universe.length, scanned, criteria: { ...CRITERIA, excludedSubIndustry: CRITERIA.excludedSubIndustry.source }, candidates,
}, null, 2) + '\n');
console.log(`Pronto: ${candidates.length} candidatas de ${scanned} empresas analisadas.`);
