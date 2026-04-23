# XON STREAM Backend

Backend API service for XON STREAM video streaming platform.

## Deployment on Hugging Face Spaces

### Prerequisites
- Hugging Face account
- Docker installed locally (for testing)

### Deployment Steps

1. **Create a new Hugging Face Space**
   - Go to https://huggingface.co/spaces
   - Click "Create new Space"
   - Select "Docker" as the SDK
   - Choose a name for your space

2. **Set Environment Variables**
   In your Space settings, add these secrets:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_KEY` - Your Supabase API key
   - `PORT` - Set to 3000 (or leave default)
   - Any other variables from `.env.example`

3. **Push to Hugging Face**
   ```bash
   git clone https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME
   cd YOUR_SPACE_NAME
   cp -r /path/to/backend/* .
   git add .
   git commit -m "Initial deployment"
   git push
   ```

### Local Development

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your credentials

# Run in development
npm run dev

# Run in production
npm start
```

### API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/posts` - Get posts
- `GET /api/channels` - Get channels
- `GET /api/categories` - Get categories
- `GET /api/search` - Search content

### Docker Build

```bash
docker build -t xonstream-backend .
docker run -p 3000:3000 --env-file .env xonstream-backend
```
