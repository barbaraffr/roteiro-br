# Deploy do RoteiroBR

App full-stack: React (Vite) + Express + tRPC + MySQL.

## Local

```bash
cp .env.example .env
# edite o .env com MySQL e chaves Forge

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
| `DATABASE_URL` | URL do MySQL do Railway (pode usar referência `${{MySQL.MYSQL_URL}}` se disponível) |
| `BUILT_IN_FORGE_API_URL` | `https://forge.butterfly-effect.dev` |
| `BUILT_IN_FORGE_API_KEY` | sua chave Forge (backend) |
| `VITE_FRONTEND_FORGE_API_URL` | `https://forge.butterfly-effect.dev` |
| `VITE_FRONTEND_FORGE_API_KEY` | sua chave Forge (frontend) |
| `OAUTH_SERVER_URL` | (opcional) URL do servidor OAuth Manus |
| `VITE_OAUTH_PORTAL_URL` | (opcional) portal de login |
| `VITE_APP_ID` | (opcional) ID do app no OAuth |
| `OWNER_OPEN_ID` | (opcional) |

Importante: variáveis `VITE_*` precisam existir **no build**. Depois de salvá-las, faça um **redeploy** para o frontend receber as chaves.

### 5. Build e Start

Em **Settings** do serviço do app:

- **Build Command:** `pnpm install && pnpm build`
- **Start Command:** `pnpm start`

O `PORT` o Railway injeta sozinho; não fixe `3000` em produção.

### 6. Domínio público

Em **Settings** → **Networking** → **Generate Domain**.  
Anote a URL (ex.: `https://roteiro-br-production.up.railway.app`).

### 7. Migrar o banco

Com o app já com `DATABASE_URL` correta, rode as migrations uma vez:

**Opção A — Railway CLI**

```bash
npm i -g @railway/cli
railway login
railway link
railway run pnpm db:push
```

**Opção B — one-off no painel**

Use um comando one-off / shell do serviço, se disponível, com:

```bash
pnpm db:push
```

### 8. Conferir

1. Abra a URL pública.
2. Digite duas cidades brasileiras e calcule a rota.
3. Se o mapa ou o autocomplete falhar, revise as chaves Forge e se o último deploy foi **depois** de setar as `VITE_*`.

---

## Checklist rápido

- [ ] Repo no GitHub
- [ ] Serviço web + MySQL no Railway
- [ ] `DATABASE_URL` e `JWT_SECRET` definidos
- [ ] Chaves Forge (backend + frontend) definidas
- [ ] Build: `pnpm install && pnpm build` / Start: `pnpm start`
- [ ] Domínio gerado
- [ ] `pnpm db:push` executado uma vez
- [ ] Redeploy após alterar qualquer `VITE_*`

---

## Limitações atuais

- Rotas e mapa dependem do **proxy Manus/Forge**, não de uma chave Google Maps direta.
- Login/histórico dependem do **OAuth Manus**. Sem essas variáveis, o cálculo público ainda funciona; salvar no histórico não.
- O banco é **MySQL**. Não use Postgres sem alterar o Drizzle.

Para independência total no futuro: chave Google Cloud (Places + Directions + Maps JS) e OAuth próprio (ex.: Google).
