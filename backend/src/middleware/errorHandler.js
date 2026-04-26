const logger = require('../utils/logger');

const errorHandler = (error, request, reply) => {
  // If response was already sent, don't try to send again
  if (reply.sent) {
    return;
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  logger.error(`[${request.method}] ${request.url} - ${statusCode}: ${message}`, error);

  if (statusCode === 500) {
    reply.status(500).send({
      success: false,
      message: 'Internal Server Error'
    });
  } else {
    reply.status(statusCode).send({
      success: false,
      message: message
    });
  }
};

const notFoundHandler = (request, reply) => {
  reply.status(404).send({
    success: false,
    message: 'Route not found'
  });
};

module.exports = { errorHandler, notFoundHandler };
