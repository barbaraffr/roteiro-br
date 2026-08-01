# RoteiroBR

Calculadora de custo de viagem de carro entre cidades brasileiras.

Informe origem, destino, consumo (km/l) e preço do combustível. O app calcula
distância, tempo, gasto com combustível e pedágios — com opção de **ida e volta**.

Sem login e sem banco de dados: tudo roda com APIs públicas do ecossistema
OpenStreetMap.

---

## Como rodar

Pré-requisitos: Node.js 20+ e pnpm (ou use `npx pnpm`).

```bash
cp .env.example .env
npx pnpm install
npx pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000).

Outros comandos:

| Comando | Função |
|---|---|
| `npx pnpm test` | Testes unitários (OSM helpers e pedágios) |
| `npx pnpm check` | TypeScript (`tsc --noEmit`) |
| `npx pnpm build` | Build de produção (Vite + esbuild) |
| `npx pnpm start` | Sobe o servidor de produção |

Deploy: veja [DEPLOY.md](./DEPLOY.md).

---

## O que o app faz

1. **Busca de cidades** — autocomplete restrito ao Brasil.
2. **Inverter cidades** — botão entre origem e destino troca os dois campos.
3. **Ida e volta** — marca a opção para calcular o sentido inverso e somar custos.
4. **Rota** — distância e tempo de direção.
5. **Combustível** — `(km / km/l) × R$/litro`.
6. **Pedágios** — praças reais ao longo da rota, com tarifa de carro quando existir no OSM.
7. **Mapa** — desenha a rota (ida em verde; volta tracejada em azul).

---

## Arquitetura

```
cliente (React + Vite)
        │  tRPC
        ▼
servidor (Express)
   ├── Photon   → autocomplete
   ├── OSRM     → rota / distância / tempo / geometria
   └── Overpass → praças de pedágio (OpenStreetMap)
        │
        ▼
Leaflet + tiles OSM → mapa no navegador
```

### Frontend (`client/`)

| Parte | Uso |
|---|---|
| `pages/Home.tsx` | Tela única: formulário, resumo e mapa |
| `components/CityAutocomplete.tsx` | Campo de busca de cidades (Photon via tRPC) |
| `components/Map.tsx` / `TripMap.tsx` | Mapa Leaflet com a rota |
| `lib/trpc.ts` | Cliente tRPC |
| `components/ui/*` | Componentes de UI (shadcn/Radix) |

### Backend (`server/`)

| Parte | Uso |
|---|---|
| `_core/index.ts` | Express + Vite (dev) ou estáticos (prod) |
| `_core/trpc.ts` / `context.ts` | Setup tRPC (sem autenticação) |
| `routers.ts` | API: `trips.autocomplete` e `trips.calculate` |
| `_core/osm.ts` | Photon (busca) + OSRM (rotas) |
| `_core/tolls.ts` | Overpass + filtros de distância/sentido |
| `osm.test.ts` / `tolls.test.ts` | Testes das regras de geocoding e pedágio |

### Variáveis de ambiente

Todas opcionais, com defaults públicos:

| Variável | Padrão | Função |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `PHOTON_URL` | `https://photon.komoot.io` | Autocomplete de cidades |
| `OSRM_URL` | `https://router.project-osrm.org` | Roteamento |
| `OVERPASS_URL` | mirrors Overpass (vírgula) | Pedágios |

---

## Stack

- **React 19** + **Vite 7** + **Tailwind CSS 4**
- **Express** + **tRPC 11** + **Zod**
- **Leaflet** (mapa)
- **Photon** (geocoding / autocomplete)
- **OSRM** (rotas de carro)
- **Overpass API** (dados OSM de pedágio)
- **Vitest** (testes)

---

## Pedágios

1. Depois da rota OSRM, o servidor consulta o Overpass por nós `barrier=toll_booth` em caixas ao longo do trajeto.
2. Mantém só praças a até ~80 m da linha da rota (evita rodovias vizinhas).
3. Usa a tag `direction` do OSM para cobrar só a cabine no sentido da viagem.
4. Agrupa cabines da mesma praça.
5. Lê a tarifa de carro na tag `charge` (ex.: `5.50BRL/motorcar`). Sem tarifa → R$ 10,00 estimado (marcado com `*`).

Na **ida e volta**, cada sentido é calculado à parte — pedágios e até a distância podem diferir.

---

## Limitações

- Photon, OSRM e Overpass públicos têm limite de uso. Em produção com tráfego alto, hospede as próprias instâncias.
- Tarifas OSM podem estar desatualizadas.
- Se o Overpass falhar, a rota ainda é calculada e a tela avisa que o pedágio não foi consultado.

---

## Licença

MIT
