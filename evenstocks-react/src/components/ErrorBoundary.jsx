import React from 'react';
import '../styles/ErrorBoundary.css';

/**
 * Error Boundary Component
 * Catches React component errors and displays user-friendly messages
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorCount: 0 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Log to error tracking service (e.g., Sentry)
    console.error('Error caught by boundary:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  };

  render() {
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV === 'development';
      const { error, errorInfo, errorCount } = this.state;

      return (
        <div className="error-boundary-container">
          <div className="error-boundary-card">
            <div className="error-boundary-icon">
              <i className="fas fa-exclamation-circle"></i>
            </div>

            <h1 className="error-boundary-title">
              {errorCount > 2 ? 'Something went wrong' : 'Oops! An error occurred'}
            </h1>

            <p className="error-boundary-message">
              {errorCount > 2
                ? 'Multiple errors detected. Please refresh the page.'
                : 'We apologize for the inconvenience. Our team has been notified.'}
            </p>

            {isDev && error && (
              <details className="error-boundary-details">
                <summary>Technical Details (Development Only)</summary>
                <pre className="error-boundary-code">
                  <code>{error.toString()}</code>
                  {errorInfo && <code>{errorInfo.componentStack}</code>}
                </pre>
              </details>
            )}

            <div className="error-boundary-actions">
              <button 
                className="btn btn-primary" 
                onClick={this.resetError}
              >
                Try Again
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => window.location.href = '/'}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
