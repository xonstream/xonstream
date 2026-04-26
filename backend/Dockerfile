# Use Node.js LTS version
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build if needed)
RUN npm install --production

# Copy source code
COPY . .

# Expose port (Hugging Face Spaces uses 7860)
EXPOSE 7860

# Health check with longer start period to allow cache warmup
# Start period: 60s (allows time for migration + cache warmup)
# Interval: 30s (check every 30 seconds)
# Timeout: 5s (give health endpoint 5 seconds to respond)
# Retries: 3 (allow 3 failures before marking unhealthy)
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "const http = require('http'); const port = process.env.PORT || 7860; http.get('http://localhost:' + port + '/health', (r) => { let data = ''; r.on('data', chunk => data += chunk); r.on('end', () => { process.exit(r.statusCode === 200 ? 0 : 1); }); }).on('error', () => process.exit(1)).setTimeout(5000, () => process.exit(1))"

# Start the application
CMD ["node", "index.js"]
