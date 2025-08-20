/**
 * Custom API Error class for consistent error handling
 * Extends native Error with HTTP status codes and structured data
 */
class ApiError extends Error {
  constructor(statusCode, message, errors = [], stack = '') {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    this.isOperational = true; // Distinguish between operational and programming errors
    this.timestamp = new Date().toISOString();

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON format for API responses
   * @returns {Object} Error object for JSON response
   */
  toJSON() {
    return {
      status: 'error',
      statusCode: this.statusCode,
      message: this.message,
      errors: this.errors,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }

  /**
   * Create a BadRequest error (400)
   * @param {string} message - Error message
   * @param {Array} errors - Validation errors
   * @returns {ApiError} BadRequest error instance
   */
  static badRequest(message = 'Bad Request', errors = []) {
    return new ApiError(400, message, errors);
  }

  /**
   * Create an Unauthorized error (401)
   * @param {string} message - Error message
   * @returns {ApiError} Unauthorized error instance
   */
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  /**
   * Create a Forbidden error (403)
   * @param {string} message - Error message
   * @returns {ApiError} Forbidden error instance
   */
  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  /**
   * Create a NotFound error (404)
   * @param {string} message - Error message
   * @returns {ApiError} NotFound error instance
   */
  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  /**
   * Create a Conflict error (409)
   * @param {string} message - Error message
   * @returns {ApiError} Conflict error instance
   */
  static conflict(message = 'Conflict') {
    return new ApiError(409, message);
  }

  /**
   * Create a TooManyRequests error (429)
   * @param {string} message - Error message
   * @returns {ApiError} TooManyRequests error instance
   */
  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message);
  }

  /**
   * Create an Internal Server Error (500)
   * @param {string} message - Error message
   * @returns {ApiError} Internal server error instance
   */
  static internal(message = 'Internal Server Error') {
    return new ApiError(500, message);
  }

  /**
   * Create a Service Unavailable error (503)
   * @param {string} message - Error message
   * @returns {ApiError} Service unavailable error instance
   */
  static serviceUnavailable(message = 'Service Unavailable') {
    return new ApiError(503, message);
  }
}

export default ApiError;
