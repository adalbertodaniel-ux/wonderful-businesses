# Wonderful Businesses at Fair Prices

Dashboard de ações americanas filtradas pelos critérios de *O Tao de Warren Buffett* e *O Tao de Charlie Munger*, ordenadas do preço mais justo ao menos justo.

Para cada empresa o painel mostra: preço ao vivo, valor intrínseco (owner earnings × DCF de 2 estágios), preço-teto com margem de segurança de 25%, P/L contra a média histórica da própria empresa, ROE, ROIC, margem líquida, dívida/PL, dividend yield, idade da empresa, moat e pontos de atenção.

> Modelo educacional, não é recomendação de investimento.

## Como funciona a atualização

- **Automática:** o GitHub Actions roda todo dia útil depois do fechamento em NY, busca os dados na [Finnhub](https://finnhub.io) e grava `data/live.json`. O site se atualiza sozinho.
- **Botão no GitHub:** aba **Actions → Atualizar cotações → Run workflow**.
- **Botão no site ("↻ Atualizar agora"):** recarrega os dados mais recentes. Se você salvar sua chave da Finnhub no ⚙ do site, o botão busca os preços na hora, direto do seu navegador. A chave fica só no seu navegador.

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
| `scripts/update.mjs` | Script que busca os dados na Finnhub |
| `.github/workflows/update.yml` | Agendamento e botão de atualização |

## Metodologia

- **Filtros de qualidade:** moat durável; ROE ≥ 15% consistente (prefira ROIC, pois recompras inflam o ROE); margem líquida ≥ 15%; capex < 25–50% do lucro; dívida baixa; lucros previsíveis; nada de commodities.
- **Método A:** P/L atual ÷ P/L médio de 5–10 anos − 1.
- **Método B:** LPA (proxy de owner earnings) × múltiplo de DCF (crescimento g por 10 anos, 3% na perpetuidade, desconto de 9%).
- **Score** = média de (Preço/VI − 1) e Método A. Barato ≤ −15%; Justo até +10%; Caro acima.
- Para SPGI e GOOGL o LPA base é ajustado e fixo, porque o lucro contábil está distorcido.

Para adicionar uma empresa, inclua um item em `data/stocks.json` com os mesmos campos.
