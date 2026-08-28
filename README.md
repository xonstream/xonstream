# 🎬 XON STREAM

A modern, high-performance video streaming platform built with React, Vite, TypeScript, Tailwind CSS, Fastify, and Cloudflare Workers.

---

## ✨ Features

- ⚡ **Ultra-Fast Streaming**: Instant video playback with multi-server failover and adaptive video resolution.
- 🎭 **Actors & Channels**: Dedicated profiles for actors and channels with full video catalogs and subscriptions.
- 🎨 **Dynamic Themes**: Multiple rich themes including Cyber Dark, Pure OLED, Lightning, Sky Blue, Emerald, and Crimson.
- 📱 **Multi-Device Optimization**: Tailored responsive experiences for desktop, mobile, tablet, and iOS devices.
- 🔍 **Real-Time Search & Filtering**: Instant search across titles, actors, categories, and channels.
- 🛡️ **Admin Dashboard**: Comprehensive management portal (`/meow`) for videos, bulk imports, categories, and analytics.
- 🚀 **Edge & SEO Ready**: Automatic sitemaps, structured JSON-LD data, OpenGraph tags, and Cloudflare Edge worker support.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Radix UI + Lucide Icons
- **State & Data**: TanStack Query (React Query) + Framer Motion
- **Hosting**: Cloudflare Pages / Static Hosting

### Backend & Database
- **API**: Fastify (Node.js) & Cloudflare Workers (Edge Hono)
- **Database**: Supabase (PostgreSQL)
- **Video Storage & CDN**: Streamtape API integration

---

## 📁 Project Structure

```
xonstream/
├── frontend/             # React + Vite web application
│   ├── src/
│   │   ├── components/   # UI components (Header, PostBox, Sidebar, etc.)
│   │   ├── pages/        # Page views (Home, Watch, Actor, Channel, Admin)
│   │   ├── lib/          # API clients, store, types, and utilities
│   │   └── App.tsx       # Router and application root
│   ├── public/           # Static assets, sitemaps, verification files
│   └── package.json
│
├── cloudflare-worker/    # Serverless Edge API for Cloudflare Workers
│   ├── src/index.ts      # Edge routing, caching, and Supabase integration
│   └── wrangler.toml     # Cloudflare deployment configuration
│
├── backend/              # Fastify Node.js backend server
│   ├── src/routes/       # API endpoints (posts, channels, actors, search)
│   └── index.js          # Fastify server entrypoint
│
└── package.json          # Root workspace scripts
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **pnpm**

### 2. Installation

Clone the repository and install all dependencies:

```bash
# Install root and workspace dependencies
npm run install:all
```

### 3. Local Development

Start both the backend and frontend simultaneously:

```bash
npm run dev
```

Or run individual services:

```bash
# Run Frontend (http://localhost:5173)
npm run frontend

# Run Backend (http://localhost:3000)
npm run backend

# Run Cloudflare Worker locally
npm run worker:dev
```

---

## 🌐 Deployment

### Frontend (Cloudflare Pages)
- **Framework Preset**: `Vite`
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### Backend (Cloudflare Workers)
Deploy the serverless worker directly from your terminal:

```bash
cd cloudflare-worker
npx wrangler deploy
```

---

## 🔒 Admin Access

Access the administrative control panel by navigating to `/meow` in your browser. From there, you can:
- Add and edit video posts
- Bulk import videos from video sources
- Manage actors, channels, and categories
- Customize player and stream configurations

---

## 📄 License

This project is privately developed and maintained. All rights reserved.
