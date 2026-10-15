# Como funcionam os scrapers – RemotoJá (Dashboard pago)

Base documentada em 15/10/2026 (outra IA / Minha Vaga Remota), adaptada para o RemotoJá.

> **Demo (pré-pagamento):** só `workers/scraper/google_jobs.py` (DataForSEO).  
> **Dashboard (pós-pagamento):** este pacote — Gupy, Indeed, LinkedIn, Google Vagas (ScrapingBee); depois Catho / InfoJobs.

Testes originais com o termo **SEO** (remoto/home office, Brasil). Preferência: Python 3 com stdlib + chaves no `.env`.

## Chaves (.env na raiz do monorepo)

| Variável | Usada por |
|---|---|
| `SCRAPINGBEE_API_KEY` | google_vagas.py, indeed.py (`scrapingbee` / `auto`) |
| `TINYFISH_API_KEY` | indeed.py (`tinyfish`) |
| `SERPAPI_KEY` | google_vagas.py (`serpapi`) — opcional |
| `DATAFORSEO_USER` / `DATAFORSEO_PASS` | só o **demo** em `workers/scraper/` |

---

## Portais com base pronta (doc + scaffold)

### 1. Google Vagas – `google_vagas.py`
- Sem API pública; página `udm=8` via ScrapingBee (`stealth_proxy` + `uule` Brasil).
- ~75 créditos/req; rolagens aumentam volume.
- Demo do funil usa DataForSEO — **não misturar** com este scraper.

### 2. Indeed BR – `indeed.py`
- `br.indeed.com/jobs?q=&l=Remoto`
- Direto → 403 Cloudflare; ScrapingBee premium ou TinyFish markdown.

### 3. Gupy – `gupy.py`
- `portal.gupy.io` Next.js → `__NEXT_DATA__` → `initialJobList`.
- Grátis, sem chave; pagina até `total`.

### 4. LinkedIn – `linkedin.py`
- Guest API: `jobs-guest/jobs/api/seeMoreJobPostings/search` + `f_WT=2` (remoto) + `geoId` Brasil.
- Fallback ScrapingBee na página `/jobs/search/`.
- Sem login; volume por `--pages` (25 cards/página guest).

## Próximos

- InfoJobs  
- Catho  
- Remotar / Programathor

## Schema comum (`common.job`)

`id, source, title, company, location, remote, model, contract, salary_*, posted, url, snippet, captured_at`

## Pipeline

```
run_all.py "<cargo>"
  → gupy → indeed → linkedin → google_vagas
  → merge.py → output/merged.json
  → (futuro) API / Postgres → /app
```
