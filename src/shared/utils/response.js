import { HTTP_STATUS, STATUS_MESSAGES } from '../../core/constants/statusCodes.js';

/**
 * Standardized API Response Utility
 * Provides consistent response format across all endpoints
 */
class ApiResponse {
  constructor(success = true, statusCode = HTTP_STATUS.OK, message = null, data = null, meta = {}) {
    this.success = success;
    this.statusCode = statusCode;
    this.message = message || STATUS_MESSAGES[statusCode];
    this.data = data;
    this.meta = {
      timestamp: new Date().toISOString(),
      ...meta
    };
  }

  /**
   * Success response
   */
  static success(data = null, message = 'Request successful', statusCode = HTTP_STATUS.OK, meta = {}) {
    return new ApiResponse(true, statusCode, message, data, meta);
  }

  /**
   * Created response
   */
  static created(data = null, message = 'Resource created successfully', meta = {}) {
    return new ApiResponse(true, HTTP_STATUS.CREATED, message, data, meta);
  }

  /**
   * No content response
   */
  static noContent(message = 'Request successful') {
    return new ApiResponse(true, HTTP_STATUS.NO_CONTENT, message);
  }

  /**
   * Error response
   */
  static error(message = 'Request failed', statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, data = null, meta = {}) {
    return new ApiResponse(false, statusCode, message, data, meta);
  }

  /**
   * Bad request response
   */
  static badRequest(message = 'Bad request', data = null, meta = {}) {
    return new ApiResponse(false, HTTP_STATUS.BAD_REQUEST, message, data, meta);
  }

  /**
   * Unauthorized response
   */
  static unauthorized(message = 'Unauthorized access', meta = {}) {
    return new ApiResponse(false, HTTP_STATUS.UNAUTHORIZED, message, null, meta);
  }

  /**
   * Forbidden response
   */
  static forbidden(message = 'Access forbidden', meta = {}) {
    return new ApiResponse(false, HTTP_STATUS.FORBIDDEN, message, null, meta);
  }

  /**
   * Not found response
   */
  static notFound(message = 'Resource not found', meta = {}) {
    return new ApiResponse(false, HTTP_STATUS.NOT_FOUND, message, null, meta);
  }

  /**
   * Conflict response
   */
  static conflict(message = 'Resource conflict', data = null, meta = {}) {
    return new ApiResponse(false, HTTP_STATUS.CONFLICT, message, data, meta);
  }

  /**
   * Unprocessable entity response
   */
  static unprocessableEntity(message = 'Validation failed', data = null, meta = {}) {
    return new ApiResponse(false, HTTP_STATUS.UNPROCESSABLE_ENTITY, message, data, meta);
  }

  /**
   * Too many requests response
   */
  static tooManyRequests(message = 'Too many requests', meta = {}) {
    return new ApiResponse(false, HTTP_STATUS.TOO_MANY_REQUESTS, message, null, meta);
  }

  /**
   * Internal server error response
   */
  static internalError(message = 'Internal server error', meta = {}) {
    return new ApiResponse(false, HTTP_STATUS.INTERNAL_SERVER_ERROR, message, null, meta);
  }

  /**
   * Service unavailable response
   */
  static serviceUnavailable(message = 'Service unavailable', meta = {}) {
    return new ApiResponse(false, HTTP_STATUS.SERVICE_UNAVAILABLE, message, null, meta);
  }

  /**
   * Paginated response
   */
  static paginated(data, pagination, message = 'Request successful', meta = {}) {
    const paginationMeta = {
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || 0,
        totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
        hasNext: pagination.hasNext || false,
        hasPrev: pagination.hasPrev || false
      }
    };

    return new ApiResponse(true, HTTP_STATUS.OK, message, data, { ...paginationMeta, ...meta });
  }

  /**
   * Send response to Express response object
   */
  send(res) {
    return res.status(this.statusCode).json(this);
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      success: this.success,
      statusCode: this.statusCode,
      message: this.message,
      data: this.data,
      meta: this.meta
    };
  }
}

/**
 * Express middleware to add response helpers to res object
 */
export function addResponseHelpers(req, res, next) {
  // Add helper methods to response object
  res.success = (data, message, meta) => ApiResponse.success(data, message, HTTP_STATUS.OK, meta).send(res);
  res.created = (data, message, meta) => ApiResponse.created(data, message, meta).send(res);
  res.noContent = (message) => ApiResponse.noContent(message).send(res);
  res.error = (message, statusCode, data, meta) => ApiResponse.error(message, statusCode, data, meta).send(res);
  res.badRequest = (message, data, meta) => ApiResponse.badRequest(message, data, meta).send(res);
  res.unauthorized = (message, meta) => ApiResponse.unauthorized(message, meta).send(res);
  res.forbidden = (message, meta) => ApiResponse.forbidden(message, meta).send(res);
  res.notFound = (message, meta) => ApiResponse.notFound(message, meta).send(res);
  res.conflict = (message, data, meta) => ApiResponse.conflict(message, data, meta).send(res);
  res.unprocessableEntity = (message, data, meta) => ApiResponse.unprocessableEntity(message, data, meta).send(res);
  res.tooManyRequests = (message, meta) => ApiResponse.tooManyRequests(message, meta).send(res);
  res.internalError = (message, meta) => ApiResponse.internalError(message, meta).send(res);
  res.serviceUnavailable = (message, meta) => ApiResponse.serviceUnavailable(message, meta).send(res);
  res.paginated = (data, pagination, message, meta) => ApiResponse.paginated(data, pagination, message, meta).send(res);

  next();
}

export default ApiResponse;
