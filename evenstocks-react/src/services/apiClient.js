// Enhanced API client with error handling, retry logic, and token management
import getConfig from '../config/apiConfig';

const config = getConfig();

class APIClient {
  constructor() {
    this.requestQueue = [];
    this.isOnline = true;
  }

  async request(url, options = {}) {
    const { retries = 0, timeout = config.TIMEOUT } = options;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new APIError(
          `HTTP Error: ${response.status}`,
          response.status,
          await this.parseErrorResponse(response)
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof APIError) throw error;

      // Retry logic with exponential backoff
      if (retries < config.MAX_RETRIES && this.shouldRetry(error)) {
        const delay = config.RETRY_BACKOFF * Math.pow(2, retries);
        console.warn(`Request failed, retrying in ${delay}ms...`, error.message);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request(url, { ...options, retries: retries + 1 });
      }

      throw new APIError(
        error.message || 'Network error',
        error.code || 'NETWORK_ERROR',
        { details: error }
      );
    }
  }

  async parseErrorResponse(response) {
    try {
      return await response.json();
    } catch {
      return { message: response.statusText };
    }
  }

  shouldRetry(error) {
    // Don't retry on auth errors
    if (error.status === 401 || error.status === 403) return false;
    // Don't retry on validation errors
    if (error.status === 400 || error.status === 422) return false;
    // Retry on network errors and server errors (5xx)
    return !error.status || error.status >= 500;
  }

  post(data) {
    return this.request(`${config.API_BASE}/post`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  get(method) {
    return this.request(`${config.API_BASE}/get?method=${method}`);
  }

  // Specific API methods
  async checkUserEmail(email) {
    try {
      return await this.post({ key: 'checkUserEmail', user_email: email });
    } catch (error) {
      throw new ValidationError('Failed to check email availability', error);
    }
  }

  async login(email, password) {
    try {
      return await this.post({ 
        key: 'login', 
        loginEmail: email, 
        loginPassword: password 
      });
    } catch (error) {
      throw new AuthenticationError('Login failed. Please check your credentials.', error);
    }
  }

  async signup(formData) {
    try {
      return await this.post({ key: 'signup', ...formData });
    } catch (error) {
      throw new ValidationError('Signup failed', error);
    }
  }
}

class APIError extends Error {
  constructor(message, code = 'API_ERROR', meta = {}) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.meta = meta;
  }

  getUserMessage() {
    const messages = {
      'NETWORK_ERROR': 'Network connection failed. Please check your internet.',
      'TIMEOUT': 'Request took too long. Please try again.',
      '401': 'Your session expired. Please log in again.',
      '403': 'You do not have permission to access this resource.',
      '404': 'Resource not found.',
      '500': 'Server error. Please try again later.',
      'VALIDATION_ERROR': this.message,
    };
    return messages[this.code] || this.message;
  }
}

class AuthenticationError extends APIError {
  constructor(message, meta = {}) {
    super(message, 'AUTHENTICATION_ERROR', meta);
    this.name = 'AuthenticationError';
  }
}

class ValidationError extends APIError {
  constructor(message, meta = {}) {
    super(message, 'VALIDATION_ERROR', meta);
    this.name = 'ValidationError';
  }
}

export default new APIClient();
export { APIError, AuthenticationError, ValidationError };
