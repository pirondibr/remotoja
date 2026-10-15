# RemotoJá

SaaS de **vagas remotas no Brasil** — agrega vários portais e te coloca na frente da fila do LinkedIn.

## Arquitetura

| Parte | Onde | Pasta |
|-------|------|--------|
| Landing + funil `/onboard` + preços | **Vercel** (Next.js) | `src/` |
| Scrapers / cron / workers | **Render** | `workers/` + `render.yaml` |
| Banco (próximo) | Render Postgres ou Neon | — |

```
Usuário → Vercel (landing/funil)
              ↓ preferências
           Postgres
              ↑ vagas
           Render (scrapers)
```

## Desenvolvimento local

```bash
npm install
npm run dev
```

- Landing: http://localhost:3000  
- Funil: http://localhost:3000/onboard  
- Preços: http://localhost:3000/precos  

## Deploy

1. **Vercel** — conecte este repo; root = pasta do Next.js; build padrão `next build`.
2. **Render** — use o Blueprint `render.yaml` para o cron de scrapers (placeholder por enquanto).

## Próximos passos

- [ ] Checkout / assinatura (Stripe ou Mercado Pago)
- [ ] Scrapers reais (Gupy, Remotar, Programathor, carreiras, etc.)
- [ ] Postgres + API de matches
- [ ] Auth e área logada
