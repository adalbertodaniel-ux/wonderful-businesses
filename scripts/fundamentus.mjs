// Leitura das páginas públicas do Fundamentus (tabela de todas as ações da B3 e página de detalhes).
// As páginas vêm em ISO-8859-1 e com números no formato brasileiro (1.234,56 e 12,34%).

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' } });
  if (!r.ok) throw new Error(`${r.status} em ${url}`);
  return Buffer.from(await r.arrayBuffer()).toString('latin1');
}

// O Fundamentus escreve acentos como entidades HTML (&iacute;, &ccedil;...): decodifica antes de comparar textos
const ENT = { nbsp: ' ', amp: '&', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', atilde: 'ã', otilde: 'õ', ccedil: 'ç', acirc: 'â', ecirc: 'ê', ocirc: 'ô', agrave: 'à', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Atilde: 'Ã', Ccedil: 'Ç' };
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&([a-zA-Z]+);/g, (m, k) => ENT[k] ?? m);
const strip = (s) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

export function num(s) {
  if (s == null) return null;
  const t = String(s).replace(/%/g, '').replace(/\s/g, '').trim();
  if (!t || t === '-') return null;
  const v = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

// Posição de cada coluna caso o cabeçalho mude de texto
const FALLBACK = { papel: 0, cotacao: 1, pl: 2, pvp: 3, dy: 5, mrgEbit: 12, mrgLiq: 13, roic: 15, roe: 16, liq2m: 17, patrim: 18, divBrutPat: 19, crescRec5a: 20 };
const HEADERS = {
  papel: /papel/, cotacao: /cota/, pl: /^p\/l$/, pvp: /^p\/vp$/, dy: /div/, mrgEbit: /mrg\s*ebit/, mrgLiq: /mrg.*l[ií]q/,
  roic: /^roic$/, roe: /^roe$/, liq2m: /liq.*2/, patrim: /patrim.*l[ií]q/, divBrutPat: /d[ií]v.*brut/, crescRec5a: /cresc/,
};

export async function resultado() {
  const html = await get('https://www.fundamentus.com.br/resultado.php');
  const table = html.match(/<table[^>]*id="resultado"[\s\S]*?<\/table>/i)?.[0] || html.match(/<table[\s\S]*?<\/table>/i)?.[0];
  if (!table) throw new Error('tabela do Fundamentus não encontrada');
  const ths = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => strip(m[1]).toLowerCase());
  const idx = {};
  for (const [k, re] of Object.entries(HEADERS)) {
    const i = ths.findIndex((h) => re.test(h));
    idx[k] = i >= 0 ? i : FALLBACK[k];
  }
  const missing = ['pl', 'roe', 'roic', 'mrgLiq', 'divBrutPat', 'liq2m'].filter((k) => !ths.some((h) => HEADERS[k].test(h)));
  if (missing.length) console.warn(`Aviso: colunas não reconhecidas pelo nome (${missing.join(', ')}); usando a posição. Cabeçalhos: ${ths.join(' | ')}`);
  const out = {};
  for (const tr of table.match(/<tr[\s\S]*?<\/tr>/gi) || []) {
    const c = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => strip(m[1]));
    if (!c.length || !/^[A-Z0-9]{4}\d{1,2}$/.test(c[idx.papel])) continue;
    out[c[idx.papel]] = {
      ticker: c[idx.papel],
      price: num(c[idx.cotacao]), pe: num(c[idx.pl]), pvp: num(c[idx.pvp]), divYield: num(c[idx.dy]),
      ebitMargin: num(c[idx.mrgEbit]), netMargin: num(c[idx.mrgLiq]), roic: num(c[idx.roic]), roe: num(c[idx.roe]),
      liq2m: num(c[idx.liq2m]), equity: num(c[idx.patrim]), de: num(c[idx.divBrutPat]), revGrowth5: num(c[idx.crescRec5a]),
    };
    const o = out[c[idx.papel]];
    o.eps = o.price && o.pe ? o.price / o.pe : null; // LPA implícito
  }
  if (Object.keys(out).length < 100) throw new Error(`poucas linhas lidas (${Object.keys(out).length}); o layout pode ter mudado`);
  return out;
}

export async function detalhes(ticker) {
  const html = await get(`https://www.fundamentus.com.br/detalhes.php?papel=${ticker}`);
  const cells = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => strip(m[1]).replace(/^\?/, '').trim());
  const val = (label) => { const i = cells.findIndex((c) => c === label); return i >= 0 ? cells[i + 1] : null; };
  return { name: val('Empresa'), sector: val('Setor'), subsector: val('Subsetor') };
}
