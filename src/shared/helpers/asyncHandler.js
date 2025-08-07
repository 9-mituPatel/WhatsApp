/**
 * Async Handler Utility
 * Wraps async functions to catch errors and pass them to Express error handler
 */

/**
 * Wraps an async function to catch any errors and pass them to next()
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Express middleware function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    // Execute the async function and catch any errors
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Alternative implementation using try-catch
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Express middleware function
 */
export const asyncCatch = (fn) => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Wraps a promise and returns [error, result] tuple
 * Useful for handling promises without try-catch blocks
 * @param {Promise} promise - Promise to handle
 * @returns {Promise<Array>} - [error, result] tuple
 */
export const handleAsync = async (promise) => {
  try {
    const result = await promise;
    return [null, result];
  } catch (error) {
    return [error, null];
  }
};

/**
 * Wraps multiple async operations and returns results or first error
 * @param {Array<Promise>} promises - Array of promises
 * @returns {Promise<Array>} - [error, results] tuple
 */
export const handleMultipleAsync = async (promises) => {
  try {
    const results = await Promise.all(promises);
    return [null, results];
  } catch (error) {
    return [error, null];
  }
};

/**
 * Wraps async operation with timeout
 * @param {Promise} promise - Promise to handle
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Array>} - [error, result] tuple
 */
export const handleAsyncWithTimeout = async (promise, timeout = 5000) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Operation timeout')), timeout);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return [null, result];
  } catch (error) {
    return [error, null];
  }
};

/**
 * Retry async operation with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise<Array>} - [error, result] tuple
 */
export const retryAsync = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return [null, result];
    } catch (error) {
      if (attempt === maxRetries) {
        return [error, null];
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Debounced async handler
 * @param {Function} fn - Async function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
export const debounceAsync = (fn, delay = 300) => {
  let timeoutId;
  
  return (...args) => {
    clearTimeout(timeoutId);
    
    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
};

/**
 * Throttled async handler
 * @param {Function} fn - Async function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} - Throttled function
 */
export const throttleAsync = (fn, limit = 1000) => {
  let lastExecution = 0;
  let timeoutId;
  
  return (...args) => {
    const now = Date.now();
    
    return new Promise((resolve, reject) => {
      if (now - lastExecution >= limit) {
        lastExecution = now;
        fn(...args).then(resolve).catch(reject);
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
          lastExecution = Date.now();
          try {
            const result = await fn(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, limit - (now - lastExecution));
      }
    });
  };
};

export default asyncHandler;
