/**
 * Input Validation Utilities
 * Provides comprehensive validation for forms and user input
 */

const VALIDATION_RULES = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PHONE: /^[0-9]{10}$/,
  PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  PASSWORD_MEDIUM: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{6,}$/,
  USERNAME: /^[a-zA-Z0-9_]{3,20}$/,
  URL: /^https?:\/\/.+\..+$/,
  CREDIT_CARD: /^\d{13,19}$/,
  ZIP_CODE: /^[0-9]{5,}$/,
};

const MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  EMAIL_EXISTS: 'This email is already registered',
  INVALID_PHONE: 'Please enter a valid 10-digit phone number',
  WEAK_PASSWORD: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
  PASSWORD_MISMATCH: 'Passwords do not match',
  INVALID_USERNAME: 'Username must be 3-20 characters (letters, numbers, underscore only)',
  TOO_SHORT: (min) => `Must be at least ${min} characters`,
  TOO_LONG: (max) => `Must be no more than ${max} characters`,
  INVALID_URL: 'Please enter a valid URL',
  INVALID_CREDIT_CARD: 'Please enter a valid credit card number',
};

class ValidationError extends Error {
  constructor(field, message, code) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code;
  }
}

// Individual validators
export const validators = {
  email: (value) => {
    if (!value) throw new ValidationError('email', MESSAGES.REQUIRED, 'REQUIRED');
    if (!VALIDATION_RULES.EMAIL.test(value)) {
      throw new ValidationError('email', MESSAGES.INVALID_EMAIL, 'INVALID_EMAIL');
    }
    return true;
  },

  password: (value, strength = 'medium') => {
    if (!value) throw new ValidationError('password', MESSAGES.REQUIRED, 'REQUIRED');
    const rule = strength === 'strong' ? VALIDATION_RULES.PASSWORD_STRONG : VALIDATION_RULES.PASSWORD_MEDIUM;
    if (!rule.test(value)) {
      throw new ValidationError('password', MESSAGES.WEAK_PASSWORD, 'WEAK_PASSWORD');
    }
    return true;
  },

  passwordConfirm: (password, confirmPassword) => {
    if (!confirmPassword) {
      throw new ValidationError('confirmPassword', MESSAGES.REQUIRED, 'REQUIRED');
    }
    if (password !== confirmPassword) {
      throw new ValidationError('confirmPassword', MESSAGES.PASSWORD_MISMATCH, 'PASSWORD_MISMATCH');
    }
    return true;
  },

  username: (value) => {
    if (!value) throw new ValidationError('username', MESSAGES.REQUIRED, 'REQUIRED');
    if (!VALIDATION_RULES.USERNAME.test(value)) {
      throw new ValidationError('username', MESSAGES.INVALID_USERNAME, 'INVALID_USERNAME');
    }
    return true;
  },

  phone: (value) => {
    if (!value) throw new ValidationError('phone', MESSAGES.REQUIRED, 'REQUIRED');
    const digits = value.replace(/\D/g, '');
    if (!VALIDATION_RULES.PHONE.test(digits)) {
      throw new ValidationError('phone', MESSAGES.INVALID_PHONE, 'INVALID_PHONE');
    }
    return true;
  },

  name: (value) => {
    if (!value) throw new ValidationError('name', MESSAGES.REQUIRED, 'REQUIRED');
    if (value.trim().length < 2) {
      throw new ValidationError('name', MESSAGES.TOO_SHORT(2), 'TOO_SHORT');
    }
    if (value.length > 100) {
      throw new ValidationError('name', MESSAGES.TOO_LONG(100), 'TOO_LONG');
    }
    return true;
  },

  creditCard: (value) => {
    if (!value) throw new ValidationError('creditCard', MESSAGES.REQUIRED, 'REQUIRED');
    const digits = value.replace(/\D/g, '');
    if (!VALIDATION_RULES.CREDIT_CARD.test(digits)) {
      throw new ValidationError('creditCard', MESSAGES.INVALID_CREDIT_CARD, 'INVALID_CREDIT_CARD');
    }
    return true;
  },

  url: (value) => {
    if (!value) throw new ValidationError('url', MESSAGES.REQUIRED, 'REQUIRED');
    if (!VALIDATION_RULES.URL.test(value)) {
      throw new ValidationError('url', MESSAGES.INVALID_URL, 'INVALID_URL');
    }
    return true;
  },

  minLength: (field, value, min) => {
    if (!value || value.length < min) {
      throw new ValidationError(field, MESSAGES.TOO_SHORT(min), 'TOO_SHORT');
    }
    return true;
  },

  maxLength: (field, value, max) => {
    if (value && value.length > max) {
      throw new ValidationError(field, MESSAGES.TOO_LONG(max), 'TOO_LONG');
    }
    return true;
  },

  required: (field, value) => {
    if (!value || value.toString().trim() === '') {
      throw new ValidationError(field, MESSAGES.REQUIRED, 'REQUIRED');
    }
    return true;
  },
};

// Form-level validation
export const validateForm = (data, rules) => {
  const errors = {};

  for (const [field, fieldRules] of Object.entries(rules)) {
    try {
      const value = data[field];

      if (Array.isArray(fieldRules)) {
        for (const rule of fieldRules) {
          if (typeof rule === 'function') {
            rule(value);
          }
        }
      } else if (typeof fieldRules === 'function') {
        fieldRules(value);
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        errors[error.field] = error.message;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Sanitization
export const sanitize = {
  email: (value) => value?.trim().toLowerCase() || '',
  
  string: (value) => {
    return value
      ?.trim()
      .replace(/[<>]/g, '') // Remove HTML-like characters
      .substring(0, 1000) || ''; // Limit length
  },

  phone: (value) => {
    return value?.replace(/\D/g, '').substring(0, 20) || '';
  },

  creditCard: (value) => {
    return value?.replace(/\D/g, '').substring(0, 19) || '';
  },

  url: (value) => {
    try {
      return new URL(value).toString();
    } catch {
      return '';
    }
  },

  html: (value) => {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  },
};

// Export everything
export { ValidationError, MESSAGES, VALIDATION_RULES };
