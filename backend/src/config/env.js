const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const requiredEnvVars = [
  'PORT',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STREAMTAPE_LOGIN',
  'STREAMTAPE_KEY',
  'SEEKSTREAMING_KEY',
  'SEEKSTREAMING_PLAYER_DOMAIN',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
  'ADMIN_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`[ENV ERROR] Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 7860, // Hugging Face Spaces default port
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  STREAMTAPE_LOGIN: process.env.STREAMTAPE_LOGIN,
  STREAMTAPE_KEY: process.env.STREAMTAPE_KEY,
  SEEKSTREAMING_KEY: process.env.SEEKSTREAMING_KEY,
  SEEKSTREAMING_PLAYER_DOMAIN: process.env.SEEKSTREAMING_PLAYER_DOMAIN,
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  ADMIN_SECRET: process.env.ADMIN_SECRET
};
