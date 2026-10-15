# Workers (Render)

Scrapers e jobs de agregação de vagas rodam aqui — **não na Vercel**.

## Por quê Render?

- Cron e background workers sem timeout curto de serverless
- Processos longos (scan de portais / ATS)
- Bom encaixe com Postgres gerenciado

## Serviços planejados

| Serviço | Tipo Render | Função |
|---------|-------------|--------|
| `scraper-cron` | Cron Job | Varredura periódica dos portais |
| `match-worker` | Background Worker | Matching sob demanda / fila |
| `db` | Postgres | Vagas, preferências, assinaturas |

## Estrutura

```
workers/
  scraper/
    google_jobs.py  # Google Vagas via DataForSEO (BR)
    placeholder.py
  requirements.txt
  README.md
```

## Google Vagas (DataForSEO)

Scraping direto do Google Jobs é bloqueado por CAPTCHA. Usamos a API oficial DataForSEO:

```bash
# na raiz do repo
cp .env.example .env   # preencha DATAFORSEO_USER / DATAFORSEO_PASS
python -m workers.scraper.google_jobs --keyword "vagas de seo home office"
# ou: npm run scrape:google-jobs
```

Gera `data/demo_jobs.json` e `src/data/demo-jobs.json` (landing + funil).

## Deploy

Blueprint em `/render.yaml` na raiz do monorepo. A landing Next.js sobe na **Vercel**; estes serviços no **Render**.  
**Não ative o cron ainda** se não quiser cobrança extra — rode localmente por enquanto.
