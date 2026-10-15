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
  scraper/          # agregadores por portal (próximo passo)
  requirements.txt
  README.md
```

## Deploy

Blueprint em `/render.yaml` na raiz do monorepo. A landing Next.js sobe na **Vercel**; estes serviços no **Render**.
