import AppError from './AppError.js';

/**
 * Validation Error Class
 * Used for input validation failures
 */
class ValidationError extends AppError {
  constructor(message, details = [], field = null) {
    super(message, 400, 'VALIDATION_ERROR');
    
    this.details = details;
    this.field = field;
  }

  /**
   * Create from Joi validation error
   */
  static fromJoi(joiError) {
    const details = joiError.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value,
      type: detail.type
    }));

    return new ValidationError(
      'Validation failed',
      details,
      details[0]?.field
    );
  }

  /**
   * Create from field validation
   */
  static forField(field, message, value = null) {
    const details = [{
      field,
      message,
      value,
      type: 'custom'
    }];

    return new ValidationError(
      `Validation failed for field: ${field}`,
      details,
      field
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
        details: this.details,
        field: this.field
      }
    };
  }
}

export default ValidationError;
