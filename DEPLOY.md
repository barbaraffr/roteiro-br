# Deploy do RoteiroBR

App full-stack: React (Vite) + Express + tRPC.  
Mapas, rotas e pedágios: **OpenStreetMap** (Photon + OSRM + Overpass + Leaflet).

Sem banco de dados e sem login.

## Local

```bash
cp .env.example .env
npx pnpm install   # ou: pnpm install
npx pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000).

Sem `pnpm` instalado? Use `npx pnpm` ou instale com `npm i -g pnpm`.

## Railway (passo a passo)

1. Suba o código no GitHub.
2. No [Railway](https://railway.app): **New Project** → **Deploy from GitHub repo**.
3. Variáveis do serviço:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PHOTON_URL` | (opcional) `https://photon.komoot.io` |
| `OSRM_URL` | (opcional) `https://router.project-osrm.org` |
| `OVERPASS_URL` | (opcional) mirrors Overpass, separados por vírgula |

4. Build: `pnpm install && pnpm build`  
   Start: `pnpm start`
5. Em **Networking**, gere o domínio público.

O `PORT` o Railway injeta sozinho.

## Checklist

- [ ] Repo no GitHub
- [ ] Serviço web no Railway (sem MySQL)
- [ ] Build / Start configurados
- [ ] Domínio gerado

## Limitações

- Photon, OSRM e Overpass usam demos públicos (limites de taxa). Em tráfego alto, hospede suas próprias instâncias.
- Pedágios vêm das praças OSM (`barrier=toll_booth`). Sem tarifa no OSM, usa R$ 10,00 e marca com `*`.
- Ida e volta calcula os dois sentidos (pedágios podem diferir).
