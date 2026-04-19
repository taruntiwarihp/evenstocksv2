/**
 * EXAMPLE: Improved LoginPage.jsx with comprehensive error handling
 * This shows how to implement all the improvements in a real component
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiClient from '../services/apiClient';
import { validators, ValidationError } from '../utils/validation';
import { ErrorAlert, LoadingSpinner } from '../components/LoadingStates';
import '../styles/LoginPage.css';

const LoginPageImproved = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { isDark } = useTheme();

  // Login form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password states
  const [view, setView] = useState('login'); // login | forgot | otp | reset
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState(null);

  // Real-time email validation
  const handleEmailChange = async (value) => {
    setLoginEmail(value);
    setErrors(prev => ({ ...prev, email: '' }));

    if (!value.trim()) return;

    try {
      validators.email(value);
      // Optionally check if email exists
      // const { found } = await apiClient.post({ key: 'checkUserEmail', user_email: value });
    } catch (error) {
      if (error instanceof ValidationError) {
        setErrors(prev => ({ ...prev, [error.field]: error.message }));
      }
    }
  };

  // Handle login submission
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setApiError(null);
    setErrors({});

    try {
      // Validate inputs
      validators.email(loginEmail);
      validators.required('password', loginPassword);

      setIsSubmitting(true);

      // Login
      const response = await apiClient.login(loginEmail, loginPassword);

      if (response.status === 1 || response.status === 'success') {
        const username = response.username || loginEmail.split('@')[0];
        const token = response.token || `token_${Date.now()}`;

        // Store in auth context with expiry
        login(username, token);

        // Redirect to dashboard
        setTimeout(() => {
          navigate('/admins');
        }, 500);
      } else {
        setApiError(response.message || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        setErrors(prev => ({ ...prev, [error.field]: error.message }));
      } else {
        setApiError(error.getUserMessage?.() || 'An error occurred. Please try again.');
      }
      console.error('Login error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle forgot password
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError(null);

    try {
      validators.email(forgotEmail);
      setIsSubmitting(true);

      const response = await apiClient.post({
        key: 'sendotp',
        forgotEmail: forgotEmail,
      });

      if (response.status === 1) {
        setView('otp');
      } else {
        setForgotError(response.message || 'Failed to send OTP. Please try again.');
      }
    } catch (error) {
      setForgotError(error.getUserMessage?.() || 'Failed to send OTP.');
      console.error('Forgot password error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render login view
  if (view === 'login') {
    return (
      <div className={`login-container ${isDark ? 'dark' : ''}`}>
        <div className="login-card">
          <div className="login-header">
            <h1>Welcome Back</h1>
            <p>Sign in to your account</p>
          </div>

          {apiError && (
            <ErrorAlert
              message={apiError}
              title="Login Failed"
              onDismiss={() => setApiError(null)}
            />
          )}

          <form onSubmit={handleLoginSubmit} noValidate>
            {/* Email Field */}
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                <input
                  id="email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                  className={errors.email ? 'error' : ''}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
                {errors.email && (
                  <span className="error-message" id="email-error" role="alert">
                    {errors.email}
                  </span>
                )}
              </div>
            </div>

            {/* Password Field */}
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper password-input">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className={errors.password ? 'error' : ''}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fas fa-eye${showPassword ? '' : '-slash'}`}></i>
                </button>
                {errors.password && (
                  <span className="error-message" id="password-error" role="alert">
                    {errors.password}
                  </span>
                )}
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="forgot-password">
              <button
                type="button"
                onClick={() => setView('forgot')}
                className="link-button"
              >
                Forgot Password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !loginEmail || !loginPassword}
              className="btn btn-primary btn-block"
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="auth-footer">
            <p>
              Don't have an account?{' '}
              <Link to="/signup" className="link">
                Sign up here
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render forgot password view
  if (view === 'forgot') {
    return (
      <div className={`login-container ${isDark ? 'dark' : ''}`}>
        <div className="login-card">
          <button
            type="button"
            className="back-button"
            onClick={() => setView('login')}
          >
            <i className="fas fa-arrow-left"></i> Back to Login
          </button>

          <div className="login-header">
            <h1>Reset Password</h1>
            <p>Enter your email to receive a reset code</p>
          </div>

          {forgotError && (
            <ErrorAlert
              message={forgotError}
              title="Error"
              onDismiss={() => setForgotError(null)}
            />
          )}

          <form onSubmit={handleForgotSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="forgot-email">Email Address</label>
              <input
                id="forgot-email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !forgotEmail}
              className="btn btn-primary btn-block"
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Sending...
                </>
              ) : (
                'Send Reset Code'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
};

export default LoginPageImproved;
