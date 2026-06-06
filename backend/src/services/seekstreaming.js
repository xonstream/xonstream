const axios = require('axios');
const env = require('../config/env');
const cacheService = require('./cacheService');
const logger = require('../utils/logger');

const BASE_URL = 'https://seekstreaming.com';

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

class SeekStreamingService {
  getHeaders() {
    return {
      'api-token': env.SEEKSTREAMING_KEY,
      'Accept': 'application/json'
    };
  }

  async makeRequest(endpoint, params = {}) {
    await rateLimiter.acquire();

    const url = `${BASE_URL}${endpoint}`;

    try {
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        params,
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      logger.error(`SeekStreaming API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  async getVideoList(page = 1, perPage = 50) {
    return await this.makeRequest('/api/v1/video/manage', { page, perPage });
  }

  async getAllVideos() {
    const allVideos = [];
    let page = 1;
    let maxPage = 1;

    try {
      const firstPage = await this.getVideoList(1, 50);

      if (firstPage && firstPage.data && Array.isArray(firstPage.data)) {
        allVideos.push(...firstPage.data);
      }

      if (firstPage && firstPage.metadata) {
        maxPage = firstPage.metadata.maxPage || 1;
      }

      const requests = [];
      for (let i = 2; i <= maxPage; i++) {
        requests.push(this.getVideoList(i, 50));
      }

      if (requests.length > 0) {
        const results = await Promise.all(requests);
        results.forEach(result => {
          if (result && result.data && Array.isArray(result.data)) {
            allVideos.push(...result.data);
          }
        });
      }

      logger.info(`Fetched ${allVideos.length} videos from SeekStreaming`);
      return allVideos;
    } catch (error) {
      logger.error('Failed to fetch all videos from SeekStreaming', error);
      throw error;
    }
  }

  async getVideosForPages(startPage = 1, endPage = 20) {
    const allVideos = [];
    try {
      const requests = [];
      for (let i = startPage; i <= endPage; i++) {
        requests.push(this.getVideoList(i, 50));
      }

      if (requests.length > 0) {
        const results = await Promise.all(requests);
        results.forEach(result => {
          if (result && result.data && Array.isArray(result.data)) {
            allVideos.push(...result.data);
          }
        });
      }

      logger.info(`Fetched ${allVideos.length} videos from SeekStreaming for pages ${startPage} to ${endPage}`);
      return allVideos;
    } catch (error) {
      logger.error(`Failed to fetch videos from SeekStreaming for pages ${startPage}-${endPage}`, error);
      throw error;
    }
  }

  async getVideoDetail(videoId) {
    return await this.makeRequest(`/api/v1/video/manage/${videoId}`);
  }

  getPlayerUrl(videoId) {
    const domain = env.SEEKSTREAMING_PLAYER_DOMAIN || 'seekstreaming.com';
    return `https://${domain}/#${videoId}`;
  }

  getDownloadUrl(videoId) {
    const domain = env.SEEKSTREAMING_PLAYER_DOMAIN || 'seekstreaming.com';
    return `https://${domain}/#${videoId}&dl=1`;
  }

  getThumbnail(videoData) {
    // The API returns relative paths like: /Kq3k4aG2NdH715EJVKCn7g/ox/9dr5kx6z/3ghr5r/capture-169616.jpg
    // We prepend the player domain to create full URL: https://xonstream.seeks.cloud/Kq3k4aG2NdH715EJVKCn7g/ox/9dr5kx6z/3ghr5r/capture-169616.jpg
    if (!videoData.poster) {
      return '';
    }

    // If it's already a full URL, return as-is
    if (videoData.poster.startsWith('http://') || videoData.poster.startsWith('https://')) {
      return videoData.poster;
    }

    // Use SEEKSTREAMING_PLAYER_DOMAIN from environment variables
    const playerDomain = env.SEEKSTREAMING_PLAYER_DOMAIN || 'seekstreaming.com';
    
    // Build the full URL: https://domain.com + /path/to/poster.jpg
    const domain = playerDomain.startsWith('http') ? playerDomain : `https://${playerDomain}`;
    const posterPath = videoData.poster.startsWith('/') ? videoData.poster : `/${videoData.poster}`;
    
    return `${domain}${posterPath}`;
  }

  getPreview(videoData) {
    // The API returns relative paths like: /ksniIGl5kDOzOBvAYa5ysg/ox/9dr5kx6z/3ghr5r/preview.webp
    // We prepend the player domain to create full URL
    if (!videoData.preview) {
      return '';
    }

    // If it's already a full URL, return as-is
    if (videoData.preview.startsWith('http://') || videoData.preview.startsWith('https://')) {
      return videoData.preview;
    }

    // Use SEEKSTREAMING_PLAYER_DOMAIN from environment variables
    const playerDomain = env.SEEKSTREAMING_PLAYER_DOMAIN || 'seekstreaming.com';
    
    // Build the full URL: https://domain.com + /path/to/preview.webp
    const domain = playerDomain.startsWith('http') ? playerDomain : `https://${playerDomain}`;
    const previewPath = videoData.preview.startsWith('/') ? videoData.preview : `/${videoData.preview}`;
    
    return `${domain}${previewPath}`;
  }
}

module.exports = new SeekStreamingService();
