const logger = require('./logger');

class RAMMonitor {
  constructor(cacheService) {
    this.cacheService = cacheService;
    this.monitorInterval = null;
    this.logInterval = null;
    this.retryTimeout = null;
  }

  start() {
    this.monitorInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 30000);

    this.logInterval = setInterval(() => {
      this.logMemoryUsage();
    }, 300000);

    logger.info('RAM Monitor started', {
      checkInterval: '30s',
      logInterval: '5min',
      maxMemoryMB: 8192
    });
  }

  stop() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    if (this.logInterval) {
      clearInterval(this.logInterval);
      this.logInterval = null;
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    logger.info('RAM Monitor stopped');
  }

  getMemoryUsageMB() {
    return process.memoryUsage().heapUsed / 1024 / 1024;
  }

  async checkMemoryUsage() {
    const usedMB = this.getMemoryUsageMB();

    if (usedMB > 8192) {
      logger.warn('Memory usage exceeded 8GB, flushing cache', { usedMB: usedMB.toFixed(2) });

      this.cacheService.flushAll();

      try {
        await this.cacheService.warmCache();
        logger.info('Cache rebuilt successfully after memory flush');
      } catch (error) {
        logger.error('Failed to rebuild cache after memory flush', error);

        this.retryTimeout = setTimeout(async () => {
          try {
            await this.cacheService.warmCache();
            logger.info('Cache rebuilt successfully on retry');
          } catch (retryError) {
            logger.error('Failed to rebuild cache on retry', retryError);
          }
        }, 60000);
      }
    }
  }

  logMemoryUsage() {
    const usedMB = this.getMemoryUsageMB();
    const totalMB = process.memoryUsage().heapTotal / 1024 / 1024;
    const rssMB = process.memoryUsage().rss / 1024 / 1024;

    logger.info('Memory usage report', {
      heapUsedMB: usedMB.toFixed(2),
      heapTotalMB: totalMB.toFixed(2),
      rssMB: rssMB.toFixed(2)
    });
  }
}

module.exports = RAMMonitor;
