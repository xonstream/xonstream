# XON STREAM - Deployment Guide

## Project Overview
XON STREAM is a premium adult video streaming platform with:
- **Frontend**: React + Vite (deployed on Cloudflare Pages)
- **Backend**: Node.js + Express (deployed on Hugging Face Spaces with Docker)

---

## FRONTEND DEPLOYMENT - Cloudflare Pages

### Prerequisites
1. Cloudflare account (free tier available)
2. GitHub/GitLab repository with your frontend code

### Step-by-Step Deployment

#### Option 1: Direct Git Integration (Recommended)

1. **Push your code to GitHub**
   ```bash
   cd frontend
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Create Cloudflare Pages Project**
   - Go to https://dash.cloudflare.com/?to=/:account/pages
   - Click "Create a project"
   - Connect your Git repository
   - Configure build settings:
     - **Project name**: xonstream
     - **Production branch**: main
     - **Build command**: `npm install && npm run build`
     - **Build output directory**: `dist`
     - **Root directory**: `/frontend` (if monorepo)

3. **Environment Variables** (if needed)
   - Go to Settings > Environment Variables
   - Add any required variables

4. **Deploy**
   - Click "Save and Deploy"
   - Cloudflare will automatically build and deploy

#### Option 2: Manual Deploy with Wrangler CLI

1. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

3. **Deploy**
   ```bash
   cd frontend
   wrangler pages publish dist --project-name=xonstream
   ```

### Custom Domain Setup

1. Go to your Cloudflare Pages project
2. Navigate to "Custom domains"
3. Add your domain (e.g., xonstream.com)
4. Cloudflare will automatically configure DNS

---

## BACKEND DEPLOYMENT - Hugging Face Spaces

### Prerequisites
1. Hugging Face account
2. Docker installed locally (for testing)

### Step-by-Step Deployment

1. **Create Hugging Face Space**
   - Go to https://huggingface.co/spaces
   - Click "Create new Space"
   - Configure:
     - **Space name**: xonstream-backend (or your preferred name)
     - **License**: Private (recommended for backend)
     - **SDK**: Docker
     - **Visibility**: Private

2. **Prepare Your Repository**
   ```bash
   # Clone your new Hugging Face Space
   git clone https://huggingface.co/spaces/YOUR_USERNAME/xonstream-backend
   cd xonstream-backend
   
   # Copy backend files
   cp -r /path/to/your/backend/* .
   
   # Commit and push
   git add .
   git commit -m "Initial backend deployment"
   git push
   ```

3. **Set Environment Variables (Secrets)**
   - Go to your Space Settings
   - Navigate to "Variables and Secrets"
   - Add these secrets:
     ```
     SUPABASE_URL=your_supabase_project_url
     SUPABASE_KEY=your_supabase_api_key
     PORT=3000
     NODE_ENV=production
     ```
   - Mark sensitive values as "Secret"

4. **Automatic Deployment**
   - Hugging Face will automatically detect the Dockerfile
   - Build and deployment happens automatically
   - Check the "Logs" tab for deployment status

### Local Docker Testing

```bash
cd backend

# Build Docker image
docker build -t xonstream-backend .

# Run container
docker run -p 3000:3000 --env-file .env xonstream-backend

# Test the API
curl http://localhost:3000/health
```

---

## SEO CONFIGURATION

### What's Already Configured

✅ **robots.txt** - Allows search engine crawling with proper rules
✅ **sitemap.xml** - Lists all important pages for indexing
✅ **Meta Tags** - Full SEO optimization with adult content keywords
✅ **Open Graph** - Social media sharing optimization
✅ **Twitter Cards** - Twitter sharing optimization
✅ **Structured Data** - JSON-LD for Google rich snippets
✅ **Adult Content Tags** - RTA labeling and age verification meta tags

### Submit to Search Engines

1. **Google Search Console**
   - Go to https://search.google.com/search-console
   - Add your property (xonstream.com)
   - Verify ownership
   - Submit sitemap: `https://xonstream.com/sitemap.xml`

2. **Bing Webmaster Tools**
   - Go to https://www.bing.com/webmasters
   - Add your site
   - Submit sitemap

3. **Yandex Webmaster** (if targeting Russian audience)
   - Go to https://webmaster.yandex.com
   - Add and verify your site

### SEO Best Practices Implemented

- ✅ Keyword-optimized title and description
- ✅ Adult content rating meta tags
- ✅ RTA (Restricted to Adults) labeling
- ✅ Canonical URLs to prevent duplicate content
- ✅ Schema.org structured data for video content
- ✅ Mobile-friendly responsive design
- ✅ Fast loading with Cloudflare CDN
- ✅ Proper heading hierarchy
- ✅ Image optimization with alt tags

---

## ENVIRONMENT VARIABLES

### Frontend (Cloudflare Pages)
No sensitive environment variables needed for frontend.

### Backend (Hugging Face Spaces)

Create a `.env` file locally with:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_api_key
PORT=3000
NODE_ENV=production
```

**Never commit .env files to version control!**

---

## POST-DEPLOYMENT CHECKLIST

### Frontend
- [ ] Site loads correctly at your domain
- [ ] All routes work (home, search, categories, etc.)
- [ ] Logo/favicon displays properly
- [ ] Mobile responsive design works
- [ ] SEO meta tags are present (check with browser DevTools)
- [ ] Sitemap is accessible at `/sitemap.xml`
- [ ] robots.txt is accessible at `/robots.txt`

### Backend
- [ ] Health check endpoint works: `/health`
- [ ] API endpoints return data
- [ ] CORS is properly configured for your frontend domain
- [ ] Environment variables are set correctly
- [ ] Database connection is working

### SEO
- [ ] Submit sitemap to Google Search Console
- [ ] Submit sitemap to Bing Webmaster Tools
- [ ] Test with Google Rich Results Test: https://search.google.com/test/rich-results
- [ ] Check meta tags with Facebook Debugger: https://developers.facebook.com/tools/debug/
- [ ] Verify with Twitter Card Validator: https://cards-dev.twitter.com/validator

---

## MONITORING & ANALYTICS

### Recommended Tools

1. **Cloudflare Analytics** (built-in)
   - Traffic statistics
   - Performance metrics
   - Security events

2. **Google Analytics**
   - Add to `index.html` in the `<head>` section
   - Track user behavior

3. **Hugging Face Space Logs**
   - Monitor backend errors
   - Track API usage

---

## TROUBLESHOOTING

### Frontend Issues

**Build fails on Cloudflare Pages:**
- Check Node.js version (should be 18+)
- Verify all dependencies in package.json
- Check build logs in Cloudflare dashboard

**Routes not working:**
- Cloudflare Pages should auto-detect SPA
- If needed, add `_redirects` file to `public/`:
  ```
  /*    /index.html   200
  ```

### Backend Issues

**Docker build fails:**
- Check Dockerfile syntax
- Verify all files exist
- Test locally with `docker build`

**API not responding:**
- Check Hugging Face Space logs
- Verify environment variables are set
- Ensure port is correctly configured (3000)

---

## SECURITY CONSIDERATIONS

✅ Environment variables stored as secrets
✅ CORS configured for specific origins
✅ Helmet.js for security headers
✅ Rate limiting enabled
✅ Input validation on all endpoints
✅ RTA labeling for adult content compliance
✅ 2257 compliance page included

---

## SUPPORT

For issues or questions:
- Check deployment logs
- Review this guide
- Contact: security@xonstream.com

---

**Last Updated**: January 2024
