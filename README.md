# Wonderful Businesses at Fair Prices

Duas abas: **🇺🇸 EUA** e **🇧🇷 Brasil**, com a mesma filosofia e réguas de preço próprias para cada mercado.

Dashboard de ações americanas filtradas pelos critérios de *O Tao de Warren Buffett* e *O Tao de Charlie Munger*, ordenadas do preço mais justo ao menos justo.

Para cada empresa o painel mostra: preço ao vivo, valor intrínseco (owner earnings × DCF de 2 estágios), preço-teto com margem de segurança de 25%, P/L contra a média histórica da própria empresa, ROE, ROIC, margem líquida, dívida/PL, dividend yield, idade da empresa, moat e pontos de atenção.

> Modelo educacional, não é recomendação de investimento.

## Como funciona a atualização

- **Automática:** o GitHub Actions roda todo dia útil depois do fechamento em NY, busca os dados na [Finnhub](https://finnhub.io) e grava `data/live.json`. O site se atualiza sozinho.
- **Botão no GitHub:** aba **Actions → Atualizar cotações → Run workflow**.
- **Botão no site ("↻ Atualizar agora"):** recarrega os dados mais recentes. Se você salvar sua chave da Finnhub no ⚙ do site, o botão busca os preços na hora, direto do seu navegador. A chave fica só no seu navegador.

## Novas empresas: screener mensal

A lista principal é curada (o moat é julgado por uma pessoa). Para encontrar novas empresas:

- **Robô mensal:** todo dia 1º, o workflow **Buscar novas candidatas** varre o S&P 500 + S&P 400 (~900 empresas) na Finnhub e aplica os filtros numéricos: ROE e ROIC médios de 5 anos ≥ 15%, margem líquida média ≥ 15%, dívida/PL ≤ 1,5, lucro positivo e consistente, e exclusão de setores de commodity (energia, utilities, materiais, imobiliário, bancos, aéreas, montadoras). Leva ~20 minutos. Para rodar na hora: Actions → Buscar novas candidatas → Run workflow.
- **Aba "Candidatas" no site:** mostra quem passou, já com valor intrínseco, preço-teto e score. O crescimento usado (g) é 70% do crescimento de LPA dos últimos 5 anos, limitado entre 3% e 10%.
- **Aprovar:** clique em **Aprovar** na aba (copia o ticker e abre o GitHub) ou vá em Actions → Aprovar candidata → Run workflow → digite o ticker. A empresa entra na lista principal com o moat marcado como "A avaliar"; edite `data/stocks.json` para descrever o moat.

Os limites dos filtros ficam no topo de `scripts/screen.mjs` (`CRITERIA`).

## Aba Brasil

- **Dados:** o robô **Atualizar cotações Brasil** lê todo dia útil, após o fechamento da B3, a tabela pública do [Fundamentus](https://www.fundamentus.com.br) (preço, P/L, ROE, ROIC, margem, dívida, dividend yield). Não precisa de chave. Para preço do momento no botão "Atualizar agora", salve no ⚙ uma chave grátis da [brapi.dev](https://brapi.dev).
- **Régua de preço:** desconto de 15% ao ano em reais (acima da Selic), 4,5% de crescimento na perpetuidade e margem de segurança de 25%. Por isso o P/L "justo" no Brasil é mais ou menos a metade do americano.
- **Filtros adaptados:** sem estatais (incentivos desalinhados, como alertava Munger) e sem commodities, construção, energia e saneamento. Bancos entram só na lista curada (Itaú, BTG), com ROIC, margem e dívida marcados como "não se aplica".
- **Screener mensal (dia 2):** **Buscar novas candidatas Brasil** filtra as ações líquidas da B3 (ROE ≥ 20%, ROIC ≥ 15%, margem ≥ 10%, dívida líquida/PL ≤ 1, receita +5% em 5 anos) e guarda 1 ponto por mês de P/L, ROE e ROIC em `data/br-history.json`. Com 12 meses, o "P/L vs histórico" passa a funcionar.
- **Aprovar:** o mesmo workflow **Aprovar candidata** serve para os dois mercados (ex.: `WEGE3` ou `ODFL`).

## Configuração (uma vez só)

1. **Chave grátis da Finnhub:** crie em https://finnhub.io/register e copie a API key.
2. **Secret no repositório:** Settings → Secrets and variables → Actions → New repository secret. Nome `FINNHUB_KEY`, valor = sua chave.
3. **Ligar o site:** Settings → Pages → Source: *Deploy from a branch* → Branch `main`, pasta `/ (root)` → Save. Em 1–2 minutos o site fica em `https://SEU-USUARIO.github.io/wonderful-businesses/`.
4. **Primeira atualização:** Actions → Atualizar cotações → Run workflow.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | O dashboard (HTML + JS, sem dependências) |
| `data/stocks.json` | Lista de empresas, moat, crescimento assumido (g), P/L histórico e LPA base. Revise a cada trimestre |
| `data/live.json` | Preços e indicadores ao vivo, gerado pelo Actions |
| `data/candidates.json` | Empresas que passaram no screener mensal, gerado pelo Actions |
| `scripts/update.mjs` | Script que busca os dados na Finnhub |
| `scripts/screen.mjs` | Screener mensal (S&P 500 + S&P 400) |
| `scripts/approve.mjs` | Move uma candidata para a lista principal (EUA ou Brasil) |
| `data/br-stocks.json`, `data/br-live.json`, `data/br-candidates.json` | Equivalentes brasileiros |
| `scripts/fundamentus.mjs`, `scripts/br-update.mjs`, `scripts/br-screen.mjs` | Leitura do Fundamentus, atualização diária e screener mensal do Brasil |
| `.github/workflows/update.yml` | Atualização diária de preços |
| `.github/workflows/screen.yml` | Screener mensal |
| `.github/workflows/approve.yml` | Botão de aprovação de candidata |

## Metodologia

- **Filtros de qualidade:** moat durável; ROE ≥ 15% consistente (prefira ROIC, pois recompras inflam o ROE); margem líquida ≥ 15%; capex < 25–50% do lucro; dívida baixa; lucros previsíveis; nada de commodities.
- **Método A:** P/L atual ÷ P/L médio de 5–10 anos − 1.
- **Método B:** LPA (proxy de owner earnings) × múltiplo de DCF (crescimento g por 10 anos, 3% na perpetuidade, desconto de 9%).
- **Score** = média de (Preço/VI − 1) e Método A. Barato ≤ −15%; Justo até +10%; Caro acima.
- Para SPGI e GOOGL o LPA base é ajustado e fixo, porque o lucro contábil está distorcido.

Para adicionar uma empresa, inclua um item em `data/stocks.json` com os mesmos campos.
