# Deploy do RoteiroBR

App full-stack: React (Vite) + Express + tRPC + MySQL.  
Mapas e rotas: **OpenStreetMap** (Photon + OSRM + Leaflet).

## Local

```bash
cp .env.example .env
# edite o .env com MySQL (PHOTON_URL/OSRM_URL são opcionais)

pnpm install
pnpm db:push
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000).

---

## Railway (passo a passo)

### 1. Subir o código no GitHub

```bash
git remote add origin https://github.com/SEU_USUARIO/roteiro-br.git
git push -u origin main
```

(Se o remoto já existir, só faça o `push`.)

### 2. Criar o projeto no Railway

1. Acesse [railway.app](https://railway.app) e faça login (GitHub).
2. **New Project** → **Deploy from GitHub repo** → selecione `roteiro-br`.
3. O Railway detecta Node/pnpm pelo `package.json`.

### 3. Adicionar MySQL

1. No projeto: **+ New** → **Database** → **MySQL**.
2. Abra o serviço MySQL → **Variables** (ou **Connect**).
3. Copie a URL de conexão (algo como `mysql://root:...@...railway.app:3306/railway`).

### 4. Variáveis do app

No serviço do **app** (não no MySQL): **Variables** → adicione:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | gere com `openssl rand -base64 32` |
| `DATABASE_URL` | URL do MySQL do Railway (ex.: `${{MySQL.MYSQL_URL}}`) |
| `PHOTON_URL` | (opcional) `https://photon.komoot.io` |
| `OSRM_URL` | (opcional) `https://router.project-osrm.org` |
| `OAUTH_SERVER_URL` | (opcional) OAuth Manus |
| `VITE_OAUTH_PORTAL_URL` | (opcional) portal de login |
| `VITE_APP_ID` | (opcional) ID do app |
| `OWNER_OPEN_ID` | (opcional) |

Rotas e mapa **não** precisam mais de chaves Forge/Google.

### 5. Build e Start

Em **Settings** do serviço do app:

- **Build Command:** `pnpm install && pnpm build`
- **Start Command:** `pnpm start`

O `PORT` o Railway injeta sozinho; não fixe `3000` em produção.

### 6. Domínio público

Em **Settings** → **Networking** → **Generate Domain**.

### 7. Migrar o banco

```bash
npm i -g @railway/cli
railway login
railway link
railway run pnpm db:push
```

Ou rode `pnpm db:push` num shell/one-off do serviço.

### 8. Conferir

1. Abra a URL pública.
2. Digite duas cidades brasileiras e calcule a rota.
3. O mapa Leaflet deve mostrar a linha da rota (tiles OSM).

---

## Checklist rápido

- [ ] Repo no GitHub
- [ ] Serviço web + MySQL no Railway
- [ ] `DATABASE_URL` e `JWT_SECRET` definidos
- [ ] Build: `pnpm install && pnpm build` / Start: `pnpm start`
- [ ] Domínio gerado
- [ ] `pnpm db:push` executado uma vez

---

## Limitações atuais

- Autocomplete usa **Photon** (demo público); rotas usam **OSRM** (demo público). Em tráfego alto, hospede suas próprias instâncias e aponte `PHOTON_URL` / `OSRM_URL`.
- Pedágios continuam **estimados** (não há fonte OSM oficial de pedágios BR).
- Login/histórico ainda dependem do **OAuth Manus** (opcional). Sem isso, o cálculo público funciona.
- O banco é **MySQL**.
- Histórico antigo com `placeId` do Google Maps não recalcula — faça novas buscas.
