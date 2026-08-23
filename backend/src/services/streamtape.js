const axios = require('axios');
const env = require('../config/env');
const cacheService = require('./cacheService');
const logger = require('../utils/logger');

const BASE_URL = 'https://api.streamtape.com';

class TokenBucket {
  constructor(maxRequests = 40, windowMs = 1000) {
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

    const waitTime = Math.max(10, Math.floor(this.windowMs / this.maxRequests));
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

  isConfigured() {
    const { login, key } = this.getAuthParams();
    return (
      login &&
      key &&
      login !== 'your_streamtape_login_here' &&
      key !== 'your_streamtape_key_here' &&
      key !== 'your_streamtape_api_key_here'
    );
  }

  async makeRequest(endpoint, params = {}) {
    if (!this.isConfigured()) {
      logger.warn(`Streamtape API credentials are not configured or are placeholders.`);
      throw new Error('Streamtape API credentials not configured');
    }

    await rateLimiter.acquire();

    const authParams = this.getAuthParams();
    const queryParams = new URLSearchParams({ ...authParams, ...params });
    const url = `${BASE_URL}${endpoint}?${queryParams.toString()}`;

    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          Accept: 'application/json'
        }
      });

      if (response.data && response.data.status === 200) {
        return response.data.result;
      }

      const errMsg = response.data?.msg || `Streamtape error (status ${response.data?.status || 'unknown'})`;
      throw new Error(errMsg);
    } catch (error) {
      logger.error(`Streamtape API error [${endpoint}]:`, error.message);
      throw error;
    }
  }

  async getAccountInfo() {
    return await this.makeRequest('/account/info');
  }

  async getFileList(folder = '') {
    const params = folder ? { folder } : {};
    const result = await this.makeRequest('/file/listfolder', params);
    return result || { folders: [], files: [] };
  }

  async getAllFiles() {
    if (!this.isConfigured()) {
      logger.warn('Streamtape not configured, returning empty files list.');
      return [];
    }

    const allFiles = [];
    const visitedFolders = new Set();
    const folderQueue = ['']; // Start with root folder

    while (folderQueue.length > 0) {
      const currentFolder = folderQueue.shift();
      if (visitedFolders.has(currentFolder)) continue;
      visitedFolders.add(currentFolder);

      try {
        const result = await this.getFileList(currentFolder);

        // Collect files from current folder
        if (result && Array.isArray(result.files)) {
          for (const file of result.files) {
            allFiles.push({
              name: file.name,
              linkid: file.linkid,
              link: file.link || `https://streamtape.com/v/${file.linkid}`,
              size: file.size || 0,
              folderid: currentFolder || '0',
              created_at: file.created_at,
              convert: file.convert
            });
          }
        }

        // Enqueue subfolders
        if (result && Array.isArray(result.folders)) {
          for (const folder of result.folders) {
            if (folder.id && !visitedFolders.has(folder.id)) {
              folderQueue.push(folder.id);
            }
          }
        }
      } catch (err) {
        logger.error(`Failed to list folder "${currentFolder}" from Streamtape:`, err.message);
        // If root folder fails, throw so caller knows authentication or API failed
        if (currentFolder === '') {
          throw err;
        }
      }
    }

    logger.info(`Streamtape: Fetched a total of ${allFiles.length} files across ${visitedFolders.size} folder(s).`);
    return allFiles;
  }

  getEmbedUrl(videoId) {
    if (!videoId) return '';
    return `https://streamtape.com/e/${videoId}`;
  }

  getDownloadUrl(videoId) {
    if (!videoId) return '';
    return `https://streamtape.com/v/${videoId}`;
  }

  getDefaultThumbnailUrl(videoId) {
    if (!videoId) return '';
    return `https://thumb.tapecontent.net/thumb/${videoId}/thumb.jpg`;
  }

  async getThumbnail(videoId) {
    if (!videoId) return '';

    const cacheKey = `video:streamtape:thumb:${videoId}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      const fileInfo = await this.makeRequest('/file/info', { file: videoId });
      if (fileInfo && fileInfo[videoId]?.thumb) {
        const thumbUrl = fileInfo[videoId].thumb;
        cacheService.set(cacheKey, thumbUrl, 86400);
        return thumbUrl;
      }

      const result = await this.makeRequest('/file/getsplash', { file: videoId });
      if (result && typeof result === 'string') {
        cacheService.set(cacheKey, result, 86400);
        return result;
      }
    } catch (error) {
      // Ignore and fallback to standard CDN thumbnail
    }

    const fallbackUrl = this.getDefaultThumbnailUrl(videoId);
    cacheService.set(cacheKey, fallbackUrl, 86400);
    return fallbackUrl;
  }

  async getBatchThumbnails(videoIds = []) {
    if (!videoIds || videoIds.length === 0) return {};
    const thumbMap = {};
    const missingIds = [];

    for (const id of videoIds) {
      const cached = cacheService.get(`video:streamtape:thumb:${id}`);
      if (cached) {
        thumbMap[id] = cached;
      } else {
        missingIds.push(id);
      }
    }

    if (missingIds.length === 0) return thumbMap;

    const chunkSize = 50;
    for (let i = 0; i < missingIds.length; i += chunkSize) {
      const chunk = missingIds.slice(i, i + chunkSize);
      try {
        const fileInfo = await this.getFileInfo(chunk);
        if (fileInfo && typeof fileInfo === 'object') {
          for (const id of chunk) {
            const item = fileInfo[id];
            const thumbUrl = item?.thumb || `https://thumb.tapecontent.net/thumb/${id}/thumb.jpg`;
            thumbMap[id] = thumbUrl;
            cacheService.set(`video:streamtape:thumb:${id}`, thumbUrl, 86400);
          }
        }
      } catch (err) {
        logger.warn('Failed to batch fetch thumbnails:', err.message);
        for (const id of chunk) {
          if (!thumbMap[id]) {
            thumbMap[id] = `https://thumb.tapecontent.net/thumb/${id}/thumb.jpg`;
          }
        }
      }
    }

    return thumbMap;
  }

  getDownloadUrl(videoId) {
    if (!videoId) return '';
    return `https://streamtape.com/v/${videoId}`;
  }

  async getDownloadLink(videoId) {
    if (!videoId) return '';
    return `https://streamtape.com/v/${videoId}`;
  }

  async getFileInfo(fileIds) {
    const fileParam = Array.isArray(fileIds) ? fileIds.join(',') : fileIds;
    return await this.makeRequest('/file/info', { file: fileParam });
  }

  async getRunningConverts() {
    return await this.makeRequest('/file/runningconverts');
  }

  async getFailedConverts() {
    return await this.makeRequest('/file/failedconverts');
  }
}

module.exports = new StreamtapeService();
