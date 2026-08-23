# XON STREAM - Complete Cloudflare Deployment Guide

## Architecture Overview
- **Backend API**: Cloudflare Workers (Edge Runtime powered by Hono + Supabase + Streamtape)
  - Global edge execution across 300+ data centers
  - 0ms cold starts with sub-10ms response times
- **Frontend Web App**: Cloudflare Pages (React + Vite + Tailwind/Modern Glassmorphism)
  - Edge static CDN hosting with instant invalidation

---

## 1. BACKEND DEPLOYMENT — Cloudflare Workers

The backend is located in the [`cloudflare-worker/`](./cloudflare-worker) directory.

### Quick Deploy (One Command)

1. Open your terminal in the `cloudflare-worker` directory:
   ```bash
   cd cloudflare-worker
   ```

2. Login to your Cloudflare account (if not already logged in):
   ```bash
   npx wrangler login
   ```

3. Deploy the worker:
   ```bash
   npx wrangler deploy
   ```

Once deployed, Wrangler will output your live Edge API URL:
> `https://xonstream-backend.<YOUR-SUBDOMAIN>.workers.dev`

### Environment Variables in `wrangler.toml`

All necessary variables are pre-configured in [`cloudflare-worker/wrangler.toml`](./cloudflare-worker/wrangler.toml):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STREAMTAPE_LOGIN`
- `STREAMTAPE_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SECRET`

---

## 2. FRONTEND DEPLOYMENT — Cloudflare Pages

### Build Configuration Details

When deploying the frontend to **Cloudflare Pages**, use the following exact settings:

| Setting | Value |
|---|---|
| **Framework Preset** | `Vite` |
| **Root Directory** | `frontend` *(or leave blank if repository root is frontend)* |
| **Build Command** | `npm run build` |
| **Build Output Directory** | `dist` |
| **Node.js Version** | `18` or `20` *(Environment variable: `NODE_VERSION=20`)* |

### Cloudflare Pages Environment Variables

In your Cloudflare Pages project under **Settings > Environment variables**, add:

| Variable Name | Value | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `https://xonstream-backend.<YOUR-SUBDOMAIN>.workers.dev` | Your live Cloudflare Worker URL |

---

## 3. Local Development

To run the Cloudflare Worker backend and frontend locally:

```bash
# In the root folder:
npm install

# Run the Cloudflare Worker locally:
npm run worker:dev

# Run the Frontend locally:
npm run frontend
```
