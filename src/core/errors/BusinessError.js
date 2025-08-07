import AppError from './AppError.js';

/**
 * Business Logic Error Class
 * Used for business rule violations and domain logic errors
 */
class BusinessError extends AppError {
  constructor(message, errorCode = 'BUSINESS_ERROR', statusCode = 400, context = {}) {
    super(message, statusCode, errorCode);
    
    this.context = context;
  }

  /**
   * Session related errors
   */
  static sessionNotFound(sessionId) {
    return new BusinessError(
      `Session not found: ${sessionId}`,
      'SESSION_NOT_FOUND',
      404,
      { sessionId }
    );
  }

  static sessionAlreadyExists(sessionId) {
    return new BusinessError(
      `Session already exists: ${sessionId}`,
      'SESSION_EXISTS',
      409,
      { sessionId }
    );
  }

  static sessionInactive(sessionId) {
    return new BusinessError(
      `Session is inactive: ${sessionId}`,
      'SESSION_INACTIVE',
      400,
      { sessionId }
    );
  }

  static maxSessionsReached(limit) {
    return new BusinessError(
      `Maximum sessions limit reached: ${limit}`,
      'MAX_SESSIONS_REACHED',
      429,
      { limit }
    );
  }

  /**
   * Message related errors
   */
  static messageNotFound(messageId) {
    return new BusinessError(
      `Message not found: ${messageId}`,
      'MESSAGE_NOT_FOUND',
      404,
      { messageId }
    );
  }

  static invalidMessageType(type) {
    return new BusinessError(
      `Invalid message type: ${type}`,
      'INVALID_MESSAGE_TYPE',
      400,
      { type }
    );
  }

  static messageDeliveryFailed(messageId, reason) {
    return new BusinessError(
      `Message delivery failed: ${reason}`,
      'MESSAGE_DELIVERY_FAILED',
      500,
      { messageId, reason }
    );
  }

  /**
   * WhatsApp provider errors
   */
  static providerNotAvailable(provider) {
    return new BusinessError(
      `WhatsApp provider not available: ${provider}`,
      'PROVIDER_NOT_AVAILABLE',
      503,
      { provider }
    );
  }

  static providerError(provider, error) {
    return new BusinessError(
      `WhatsApp provider error: ${error}`,
      'PROVIDER_ERROR',
      502,
      { provider, originalError: error }
    );
  }

  /**
   * Authentication errors
   */
  static authenticationRequired() {
    return new BusinessError(
      'Authentication required',
      'AUTHENTICATION_REQUIRED',
      401
    );
  }

  static invalidCredentials() {
    return new BusinessError(
      'Invalid credentials',
      'INVALID_CREDENTIALS',
      401
    );
  }

  static tokenExpired() {
    return new BusinessError(
      'Token has expired',
      'TOKEN_EXPIRED',
      401
    );
  }

  /**
   * Rate limiting errors
   */
  static rateLimitExceeded(limit, windowMs) {
    return new BusinessError(
      `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
      'RATE_LIMIT_EXCEEDED',
      429,
      { limit, windowMs }
    );
  }

  /**
   * Media errors
   */
  static invalidMediaType(type) {
    return new BusinessError(
      `Invalid media type: ${type}`,
      'INVALID_MEDIA_TYPE',
      400,
      { type }
    );
  }

  static mediaUploadFailed(reason) {
    return new BusinessError(
      `Media upload failed: ${reason}`,
      'MEDIA_UPLOAD_FAILED',
      500,
      { reason }
    );
  }

  static mediaSizeExceeded(size, maxSize) {
    return new BusinessError(
      `Media size exceeded: ${size} bytes (max: ${maxSize} bytes)`,
      'MEDIA_SIZE_EXCEEDED',
      400,
      { size, maxSize }
    );
  }

  toJSON() {
    return {
      error: {
        name: this.name,
        message: this.message,
        code: this.errorCode,
        statusCode: this.statusCode,
        timestamp: this.timestamp,
        context: this.context,
        ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
      }
    };
  }
}

export default BusinessError;
