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
   - Add these secrets (ALL are required):
     ```
     # Server Configuration
     PORT=7860
     NODE_ENV=production
     
     # Supabase Database (REQUIRED)
     SUPABASE_URL=https://your-project.supabase.co
     SUPABASE_ANON_KEY=your_anon_key
     SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
     
     # Streamtape API (REQUIRED)
     STREAMTAPE_LOGIN=your_streamtape_login
     STREAMTAPE_KEY=your_streamtape_key
     
     # SeekStreaming API (REQUIRED)
     SEEKSTREAMING_KEY=your_seekstreaming_key
     SEEKSTREAMING_PLAYER_DOMAIN=xonstream.seeks.cloud
     
     # Admin Panel (REQUIRED)
     ADMIN_USERNAME=admin
     ADMIN_PASSWORD=your_secure_password
     ADMIN_SECRET=your_jwt_secret_key
     
     # CORS (Optional - regex patterns already allow *.hf.space)
     CORS_ORIGIN=https://xonstream.pages.dev
     ```
   - Mark ALL sensitive values as "Secret"

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
The backend API URL is auto-detected based on hostname.

### Backend (Hugging Face Spaces)

**CRITICAL: ALL environment variables below MUST be set in Hugging Face Space Secrets**

If ANY variable is missing, the backend will fail to start with this error:
```
[ENV ERROR] Missing required environment variables: VARIABLE_NAME
```

Create these secrets in Hugging Face Space Settings > Variables and Secrets:

```env
# Server Configuration
PORT=7860                          # Hugging Face default port
NODE_ENV=production

# Supabase Database (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...       # From Supabase Dashboard > Settings > API
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... # From Supabase Dashboard > Settings > API

# Streamtape API (REQUIRED)
STREAMTAPE_LOGIN=your_login
STREAMTAPE_KEY=your_key

# SeekStreaming API (REQUIRED)
SEEKSTREAMING_KEY=your_key
SEEKSTREAMING_PLAYER_DOMAIN=xonstream.seeks.cloud

# Admin Panel (REQUIRED)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
ADMIN_SECRET=your_jwt_secret_key   # Random secure string

# CORS (Optional)
CORS_ORIGIN=https://xonstream.pages.dev
```

**How to get Supabase credentials:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings > API
4. Copy the Project URL and keys

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

## TROUBLESHOOTING

### Posts Not Loading on Hugging Face (But Working on Localhost)

**Symptom:** Posts display correctly on `localhost` but show empty/nothing on Hugging Face deployment.

**Most Common Causes:**

#### 1. Missing Environment Variables (90% of cases)

**Check:** Go to your Hugging Face Space > Logs tab

**If you see this error:**
```
[ENV ERROR] Missing required environment variables: SUPABASE_URL, STREAMTAPE_LOGIN, etc.
```

**Solution:**
1. Go to your Hugging Face Space Settings
2. Navigate to "Variables and Secrets"
3. Add ALL required environment variables (see list above)
4. Rebuild the Space (Settings > Factory Rebuild)

**Important:** The backend will NOT start if ANY required variable is missing.

#### 2. Backend Not Starting

**Check:** Go to your Hugging Face Space > Logs tab

**If the logs show:**
- No output at all
- "Starting XonStream Backend..." but then stops
- Error messages about missing modules

**Solution:**
1. Check that all dependencies are installed (package.json exists)
2. Verify Dockerfile is present and correct
3. Check that PORT=7860 is set (Hugging Face requirement)
4. Factory Rebuild the Space

#### 3. CORS Errors

**Check:** Open browser console (F12) on your frontend

**If you see:**
```
Access to fetch at 'https://xonstream-xonstream.hf.space/api/posts' from origin 'https://xonstream.pages.dev' has been blocked by CORS policy
```

**Solution:**
The backend already allows all `*.hf.space` and `*.pages.dev` origins via regex patterns. If you're using a custom domain, add it to CORS_ORIGIN environment variable.

#### 4. Supabase Connection Issues

**Check:** Backend logs for Supabase errors

**If you see:**
```
Error fetching posts from Supabase
Invalid API key
Could not find the table
```

**Solution:**
1. Verify SUPABASE_URL is correct (should be `https://xxxxx.supabase.co`)
2. Verify SUPABASE_SERVICE_ROLE_KEY is correct (not the anon key)
3. Check that Supabase tables exist: `posts`, `channels`, `actors`, `categories`, `post_categories`
4. Test Supabase connection in Supabase Dashboard > SQL Editor

#### 5. Frontend Pointing to Wrong Backend URL

**Check:** Open browser console (F12) on your frontend

**Look for:**
```
[API] Using backend URL: http://localhost:7860  ← WRONG for production!
```

**Should see:**
```
[API] Using backend URL: https://xonstream-xonstream.hf.space  ← CORRECT
```

**Solution:**
The frontend auto-detects the backend URL based on hostname:
- `localhost` → `http://localhost:7860`
- `*.pages.dev` or `*.hf.space` → `https://xonstream-xonstream.hf.space`

If auto-detection fails, set `VITE_API_BASE_URL` in Cloudflare Pages environment variables.

### Quick Diagnostic Checklist

Run through these steps in order:

1. ✅ **Check Hugging Face Space Logs**
   - Look for startup errors
   - Verify "Server running on port 7860" message appears
   
2. ✅ **Test Health Endpoint**
   - Open: `https://your-space.hf.space/health`
   - Should return: `{"status":"healthy",...}`
   - If this fails, backend is not running

3. ✅ **Test Posts API Directly**
   - Open: `https://your-space.hf.space/api/posts`
   - Should return: `{"success":true,"data":[...]}`
   - If this fails, check Supabase connection

4. ✅ **Check Frontend Console**
   - Open browser DevTools (F12)
   - Look for CORS errors
   - Look for failed network requests
   - Check what backend URL is being used

5. ✅ **Verify Environment Variables**
   - Go to Hugging Face Space Settings > Variables and Secrets
   - Count: Should have at least 11 variables set
   - Names must match EXACTLY (case-sensitive)

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
