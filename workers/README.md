# Workers Minha Vaga Remota

Dois grupos separados de propósito:

| Grupo | Pasta | Quando | Fontes |
|-------|--------|--------|--------|
| **Demo / funil** | `workers/scraper/` | Antes de pagar (landing, `/final`, `/onboard`) | Só Google Jobs via **DataForSEO** |
| **Dashboard pago** | `workers/dashboard/` | Depois de pagar (`/app`) | Gupy + Indeed + LinkedIn + Google Vagas + futuros |

Doc detalhada do dashboard: [`dashboard/COMO-FUNCIONA.md`](dashboard/COMO-FUNCIONA.md)

## Demo (funil)

```bash
python -m workers.scraper.google_jobs --role SEO
# ou: npm run scrape:google-jobs
```

## Dashboard (multi-portal)

```bash
# só Gupy (grátis, sem chave)
python -m workers.dashboard.gupy SEO

# Indeed (SCRAPINGBEE_API_KEY ou TINYFISH_API_KEY)
python -m workers.dashboard.indeed SEO --provider tinyfish

# LinkedIn (guest API; fallback ScrapingBee)
python -m workers.dashboard.linkedin SEO

# Google Vagas ScrapingBee
python -m workers.dashboard.google_vagas SEO --scrolls 2

# pipeline completa + merge
python -m workers.dashboard.run_all SEO
python -m workers.dashboard.merge --write-app
```

Saídas em `workers/dashboard/output/*.json` (merged no final).

### Próximos portais

InfoJobs · Catho · Remotar · Programathor

## Env

Na raiz (`.env` — não commitado):

```
DATAFORSEO_USER=
DATAFORSEO_PASS=
SCRAPINGBEE_API_KEY=
TINYFISH_API_KEY=
SERPAPI_KEY=
```

## Render

Cron/workers longos ficam no Render (`render.yaml`). Landing na Vercel.  
Não ligue o cron pago até validar os scrapers localmente.
