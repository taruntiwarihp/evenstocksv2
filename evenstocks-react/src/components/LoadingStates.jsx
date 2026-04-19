import React from 'react';
import '../styles/LoadingStates.css';

/**
 * Loading Spinner Component
 * Displays loading state with customizable size and message
 */
export const LoadingSpinner = ({ 
  size = 'md', 
  message = 'Loading...',
  fullScreen = false 
}) => {
  const containerClass = fullScreen ? 'spinner-fullscreen' : 'spinner-inline';
  
  return (
    <div className={`loading-spinner ${containerClass} spinner-${size}`}>
      <div className="spinner-animation"></div>
      {message && <p className="spinner-message">{message}</p>}
    </div>
  );
};

/**
 * Empty State Component
 * Display when no data is available
 */
export const EmptyState = ({ 
  icon = 'fa-inbox',
  title = 'No Data',
  message = 'There is nothing to display here',
  action = null,
  actionText = 'Create New'
}) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <i className={`fas ${icon}`}></i>
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-message">{message}</p>
      {action && (
        <button className="btn btn-primary" onClick={action}>
          {actionText}
        </button>
      )}
    </div>
  );
};

/**
 * Error Alert Component
 * Display error messages with optional action
 */
export const ErrorAlert = ({ 
  message, 
  title = 'Error',
  onDismiss = null,
  details = null,
  action = null,
  actionText = 'Retry'
}) => {
  const [isOpen, setIsOpen] = React.useState(true);

  const handleDismiss = () => {
    setIsOpen(false);
    if (onDismiss) onDismiss();
  };

  if (!isOpen) return null;

  return (
    <div className="alert alert-error alert-dismissible">
      <div className="alert-icon">
        <i className="fas fa-exclamation-triangle"></i>
      </div>
      <div className="alert-content">
        <h4 className="alert-title">{title}</h4>
        <p className="alert-message">{message}</p>
        {details && <small className="alert-details">{details}</small>}
      </div>
      <div className="alert-actions">
        {action && (
          <button className="btn btn-sm btn-outline" onClick={action}>
            {actionText}
          </button>
        )}
        <button 
          className="btn btn-sm btn-ghost" 
          onClick={handleDismiss}
          aria-label="Dismiss alert"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>
    </div>
  );
};

/**
 * Success Alert Component
 */
export const SuccessAlert = ({ 
  message, 
  title = 'Success',
  onDismiss = null
}) => {
  const [isOpen, setIsOpen] = React.useState(true);

  const handleDismiss = () => {
    setIsOpen(false);
    if (onDismiss) onDismiss();
  };

  if (!isOpen) return null;

  return (
    <div className="alert alert-success alert-dismissible">
      <div className="alert-icon">
        <i className="fas fa-check-circle"></i>
      </div>
      <div className="alert-content">
        <h4 className="alert-title">{title}</h4>
        <p className="alert-message">{message}</p>
      </div>
      <button 
        className="btn btn-sm btn-ghost" 
        onClick={handleDismiss}
        aria-label="Dismiss alert"
      >
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

/**
 * Warning Alert Component
 */
export const WarningAlert = ({ 
  message, 
  title = 'Warning',
  onDismiss = null,
  action = null,
  actionText = 'Learn More'
}) => {
  const [isOpen, setIsOpen] = React.useState(true);

  const handleDismiss = () => {
    setIsOpen(false);
    if (onDismiss) onDismiss();
  };

  if (!isOpen) return null;

  return (
    <div className="alert alert-warning alert-dismissible">
      <div className="alert-icon">
        <i className="fas fa-exclamation-circle"></i>
      </div>
      <div className="alert-content">
        <h4 className="alert-title">{title}</h4>
        <p className="alert-message">{message}</p>
      </div>
      <div className="alert-actions">
        {action && (
          <button className="btn btn-sm btn-outline" onClick={action}>
            {actionText}
          </button>
        )}
        <button 
          className="btn btn-sm btn-ghost" 
          onClick={handleDismiss}
          aria-label="Dismiss alert"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>
    </div>
  );
};

/**
 * Info Alert Component
 */
export const InfoAlert = ({ 
  message, 
  title = 'Information',
  onDismiss = null
}) => {
  const [isOpen, setIsOpen] = React.useState(true);

  const handleDismiss = () => {
    setIsOpen(false);
    if (onDismiss) onDismiss();
  };

  if (!isOpen) return null;

  return (
    <div className="alert alert-info alert-dismissible">
      <div className="alert-icon">
        <i className="fas fa-info-circle"></i>
      </div>
      <div className="alert-content">
        <h4 className="alert-title">{title}</h4>
        <p className="alert-message">{message}</p>
      </div>
      <button 
        className="btn btn-sm btn-ghost" 
        onClick={handleDismiss}
        aria-label="Dismiss alert"
      >
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

/**
 * Skeleton Loading Component
 * Shows placeholder while content loads
 */
export const SkeletonLoader = ({ 
  count = 3, 
  type = 'card',
  height = '100px'
}) => {
  const items = Array.from({ length: count }, (_, i) => i);

  if (type === 'text') {
    return (
      <>
        {items.map((i) => (
          <div key={i} className="skeleton skeleton-text" style={{ height }}>
            <div className="skeleton-line"></div>
            <div className="skeleton-line short"></div>
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {items.map((i) => (
        <div key={i} className="skeleton skeleton-card">
          <div className="skeleton-image" style={{ height }}></div>
          <div className="skeleton-content">
            <div className="skeleton-title"></div>
            <div className="skeleton-text"></div>
          </div>
        </div>
      ))}
    </>
  );
};

export default {
  LoadingSpinner,
  EmptyState,
  ErrorAlert,
  SuccessAlert,
  WarningAlert,
  InfoAlert,
  SkeletonLoader,
};
