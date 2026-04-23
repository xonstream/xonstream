const axios = require('axios');
const env = require('../config/env');
const cacheService = require('./cacheService');
const logger = require('../utils/logger');

const BASE_URL = 'https://api.streamtape.com';

class TokenBucket {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.tokens = maxRequests;
    this.lastRefill = Date.now();
  }

  async acquire() {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }

    const waitTime = this.windowMs / this.maxRequests;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return this.acquire();
  }

  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor((elapsed / this.windowMs) * this.maxRequests);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxRequests, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }
}

const rateLimiter = new TokenBucket(40, 1000);

class StreamtapeService {
  getAuthParams() {
    return {
      login: env.STREAMTAPE_LOGIN,
      key: env.STREAMTAPE_KEY
    };
  }

  async makeRequest(endpoint, params = {}) {
    await rateLimiter.acquire();

    const authParams = this.getAuthParams();
    const queryParams = new URLSearchParams({ ...authParams, ...params });
    const url = `${BASE_URL}${endpoint}?${queryParams.toString()}`;

    console.log(`[DEBUG] Streamtape API URL: ${url.replace(authParams.key, '***')}`);

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json'
        }
      });

      console.log(`[DEBUG] Streamtape API response status:`, response.data?.status);
      console.log(`[DEBUG] Streamtape API response data:`, JSON.stringify(response.data).substring(0, 500));

      if (response.data && response.data.status === 200) {
        return response.data.result;
      }

      throw new Error(response.data?.msg || 'Streamtape API error');
    } catch (error) {
      console.log(`[DEBUG] Streamtape API error:`, error.message);
      throw error;
    }
  }

  async getThumbnail(videoId) {
    const cacheKey = `video:streamtape:thumb:${videoId}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.makeRequest('/file/getsplash', { file: videoId });
      const thumbnailUrl = result;

      cacheService.set(cacheKey, thumbnailUrl, 86400);
      return thumbnailUrl;
    } catch (error) {
      const fallbackUrl = `https://thumb.tapecontent.net/thumb/${videoId}/thumb.jpg`;
      logger.warn(`Using fallback thumbnail for ${videoId}`);
      return fallbackUrl;
    }
  }

  getEmbedUrl(videoId) {
    return `https://streamtape.com/e/${videoId}`;
  }

  async getDownloadTicket(videoId) {
    return await this.makeRequest('/file/dlticket', { file: videoId });
  }

  async getDownloadUrl(videoId, ticket, waitTime) {
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    return await this.makeRequest('/file/dl', { file: videoId, ticket });
  }

  async getDownloadLink(videoId) {
    const cacheKey = `video:streamtape:download:${videoId}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      const ticketResult = await this.getDownloadTicket(videoId);
      const { ticket, wait_time } = ticketResult;

      const downloadResult = await this.getDownloadUrl(videoId, ticket, wait_time);
      const downloadUrl = downloadResult.url;

      cacheService.set(cacheKey, downloadUrl, 21600);
      return downloadUrl;
    } catch (error) {
      logger.error(`Failed to get download link for ${videoId}`, error);
      throw error;
    }
  }

  async getFileList(folder = '') {
    const params = folder ? { folder } : {};
    console.log(`[DEBUG] Streamtape: Calling /file/listfolder with params:`, params);

    const result = await this.makeRequest('/file/listfolder', params);

    const files = [];

    // Streamtape API returns files directly in result.files
    if (result && result.files && Array.isArray(result.files)) {
      console.log(`[DEBUG] Streamtape: Found ${result.files.length} files in result.files`);
      result.files.forEach(file => {
        files.push({
          name: file.name,
          linkid: file.linkid,
          link: file.link,
          folderid: file.folderid || '',
          foldername: 'root'
        });
      });
    }

    // Also check folders if present (for subfolder listings)
    if (result && result.folders && Array.isArray(result.folders)) {
      console.log(`[DEBUG] Streamtape: Found ${result.folders.length} folders`);
    }

    console.log(`[DEBUG] Streamtape: Total files found: ${files.length}`);
    return files;
  }

  async getAllFiles() {
    return await this.getFileList();
  }
}

module.exports = new StreamtapeService();
