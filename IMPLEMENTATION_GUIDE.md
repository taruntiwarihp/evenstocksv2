# Implementation Guide: Code Improvements

This guide shows how to implement all the improvements created for the EvenStocks project.

---

## 1. Environment Variables Setup

### Create `.env.local` file:

```bash
# API Configuration
REACT_APP_API_BASE=http://localhost:5000/api
REACT_APP_WS_URL=ws://localhost:8000
REACT_APP_CHATBOT_API=http://localhost:8000
REACT_APP_TIMEOUT=30000
REACT_APP_MAX_RETRIES=3
REACT_APP_RETRY_BACKOFF=1000

# Backend Configuration
PORT=5000
EXTERNAL_API_BASE=http://localhost:5809/api
ANALYZE_API_BASE=http://localhost:5808
AGENTS_API_BASE=http://localhost:5810

# Security (NEVER commit these values!)
REACT_APP_API_KEY=your_key_here
SENDER_EMAIL=your_email@gmail.com
SENDER_PASSWORD=your_password
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
ANTHROPIC_API_KEY=your_anthropic_key
```

### .gitignore update:
```
.env
.env.local
.env.*.local
```

---

## 2. Update App.jsx with Error Boundary

### Before:
```jsx
const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};
```

### After:
```jsx
import ErrorBoundary from './components/ErrorBoundary';

const App = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};
```

---

## 3. Update AuthContext.jsx

Replace the existing `AuthContext.jsx` with the improved version:

```bash
cp src/context/AuthContext-improved.jsx src/context/AuthContext.jsx
```

This adds:
- Token expiration checking
- Session extension
- Automatic logout on expiry
- Warning notifications before expiry

---

## 4. Update API Service Layer

### Option A: Minimal Update (Quick Fix)

Update `src/services/api.js`:

```javascript
import apiClient from './apiClient';

// Replace old exports with new client methods
export const loginUser = (email, password) => 
  apiClient.login(email, password);

export const signupUser = (formData) => 
  apiClient.signup(formData);

// ... etc
```

### Option B: Full Replacement (Recommended)

```bash
rm src/services/api.js
# api.js functionality is now in apiClient.js
# Update imports across the app
```

---

## 5. Update ChatBotPageFinal.jsx

### Step 1: Replace WebSocket code

```javascript
// Remove old code:
// const WS_URL = 'ws://localhost:8000';
// const API_BASE = 'http://localhost:8000';

// Add new imports:
import { useWebSocket } from '../hooks/useWebSocket';
import getConfig from '../config/apiConfig';

// In component:
const config = getConfig();
const { isConnected, error, send } = useWebSocket(
  `${config.WS_URL}/ws/stock-chat`,
  {
    onOpen: () => console.log('Connected'),
    onMessage: handleWebSocketMessage,
    onError: handleWebSocketError,
  }
);
```

### Step 2: Add Error Handling

```javascript
import { ErrorAlert, LoadingSpinner } from '../components/LoadingStates';

// In render:
{error && (
  <ErrorAlert 
    message={error}
    title="Connection Error"
    action={() => location.reload()}
    actionText="Retry"
  />
)}

{!isConnected && (
  <LoadingSpinner 
    size="sm" 
    message="Reconnecting..."
  />
)}
```

---

## 6. Update LoginPage.jsx with Validation

### Before:
```javascript
const handleLoginSubmit = async (e) => {
  e.preventDefault();
  setLoginMessage('');
  try {
    const data = await loginUser(loginEmail, loginPassword);
    // ...
  } catch {
    setLoginMessage('Server error. Try again.');
  }
};
```

### After:
```javascript
import { validators, validateForm, ValidationError } from '../utils/validation';
import { ErrorAlert } from '../components/LoadingStates';

const [validationErrors, setValidationErrors] = useState({});

const handleLoginSubmit = async (e) => {
  e.preventDefault();
  setLoginMessage('');
  setValidationErrors({});

  // Validate form
  const rules = {
    loginEmail: (val) => validators.email(val),
    loginPassword: (val) => validators.required('password', val),
  };

  try {
    // Manual validation (or use validateForm helper)
    validators.email(loginEmail);
    validators.required('password', loginPassword);

    const data = await loginUser(loginEmail, loginPassword);
    
    if (data.status === 1 || data.status === 'success') {
      login(data.username || loginEmail, data.token || 'session');
      navigate('/admins');
    } else {
      setLoginMessage(data.message || 'Login failed. Please try again.');
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      setValidationErrors(prev => ({
        ...prev,
        [error.field]: error.message
      }));
    } else {
      setLoginMessage(
        error.message || 'An error occurred. Please try again.'
      );
    }
  }
};

// Render validation errors:
{validationErrors.loginEmail && (
  <div className="error-message">{validationErrors.loginEmail}</div>
)}
```

---

## 7. Add Loading States Everywhere

### Example: Stock Search

```javascript
import { LoadingSpinner, EmptyState } from '../components/LoadingStates';

const [loading, setLoading] = useState(false);

const handleSearch = async (query) => {
  setLoading(true);
  try {
    const results = await searchStocks(query);
    if (results.length === 0) {
      return <EmptyState 
        title="No Stocks Found"
        message={`No results for "${query}"`}
      />;
    }
    // Display results
  } finally {
    setLoading(false);
  }
};

// Render:
{loading && <LoadingSpinner message="Searching..." />}
{!loading && results.length === 0 && <EmptyState ... />}
{!loading && results.length > 0 && <StocksList ... />}
```

---

## 8. Implement Input Validation in Forms

### Example: Signup Form

```javascript
import { validators, sanitize } from '../utils/validation';

const handleSignup = async (e) => {
  e.preventDefault();
  const errors = {};

  try {
    // Validate all fields
    validators.name(formData.fullName);
    validators.email(formData.email);
    validators.username(formData.userName);
    validators.phone(formData.mobile);
    validators.password(formData.password, 'strong');
    validators.passwordConfirm(formData.password, formData.confirmPassword);

    // Sanitize data
    const cleanData = {
      fullName: sanitize.string(formData.fullName),
      email: sanitize.email(formData.email),
      userName: sanitize.string(formData.userName),
      mobile: sanitize.phone(formData.mobile),
      password: formData.password, // Never sanitize passwords
    };

    // Submit
    const result = await signupUser(cleanData);
    // Handle success
  } catch (error) {
    if (error instanceof ValidationError) {
      errors[error.field] = error.message;
    }
  }

  if (Object.keys(errors).length > 0) {
    setValidationErrors(errors);
  }
};
```

---

## 9. Backend CORS Fix

### evenstocks-backend/server.js

```javascript
// Before:
app.use(cors({
  origin: true,
  credentials: true,
}));

// After:
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5000',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

---

## 10. Add Token Expiry Warning Modal

### Create: src/components/TokenExpiryWarning.jsx

```javascript
import React from 'react';
import { useAuth } from '../context/AuthContext';

const TokenExpiryWarning = () => {
  const { tokenWarning, extendSession } = useAuth();

  if (!tokenWarning) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Session Expiring Soon</h3>
        <p>Your session will expire in 1 hour. Would you like to continue?</p>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={extendSession}>
            Continue Session
          </button>
          <button className="btn btn-secondary" onClick={() => window.location.href = '/login'}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default TokenExpiryWarning;
```

Add to App.jsx:
```javascript
import TokenExpiryWarning from './components/TokenExpiryWarning';

// Inside App render:
<TokenExpiryWarning />
```

---

## 11. Testing Checklist

- [ ] All forms validate input correctly
- [ ] Error messages are user-friendly
- [ ] Loading states appear during async operations
- [ ] WebSocket reconnects with exponential backoff
- [ ] Token expires and user is logged out
- [ ] Empty states display when no data
- [ ] Error Boundary catches component errors
- [ ] CORS errors are fixed
- [ ] Environment variables load correctly
- [ ] Mobile responsive design works

---

## 12. Implementation Timeline

### Week 1
- [ ] Set up environment variables
- [ ] Update AuthContext.jsx
- [ ] Add Error Boundary
- [ ] Update CORS in backend

### Week 2
- [ ] Update API service layer
- [ ] Update ChatBotPageFinal.jsx
- [ ] Add loading states to all pages
- [ ] Implement form validation

### Week 3
- [ ] Add token expiry warning
- [ ] Test all features
- [ ] Fix mobile responsiveness
- [ ] Complete dark mode

### Week 4
- [ ] Performance testing
- [ ] Security audit
- [ ] Documentation
- [ ] Deploy to staging

---

## 13. File Structure After Implementation

```
src/
├── config/
│   └── apiConfig.js (NEW)
├── services/
│   ├── api.js (UPDATED)
│   └── apiClient.js (NEW)
├── hooks/
│   └── useWebSocket.js (NEW)
├── utils/
│   └── validation.js (NEW)
├── components/
│   ├── ErrorBoundary.jsx (NEW)
│   ├── LoadingStates.jsx (NEW)
│   ├── TokenExpiryWarning.jsx (NEW)
│   └── ... (existing)
├── context/
│   ├── AuthContext.jsx (UPDATED)
│   └── ... (existing)
├── styles/
│   ├── ErrorBoundary.css (NEW)
│   ├── LoadingStates.css (NEW)
│   └── ... (existing)
└── ... (existing structure)
```

---

## 14. Key Improvements Summary

✅ **Error Handling:** Comprehensive try-catch blocks, user-friendly messages
✅ **Token Management:** Automatic expiry checking, session extension
✅ **WebSocket:** Exponential backoff reconnection, message queuing
✅ **Input Validation:** Comprehensive validation with sanitization
✅ **UI/UX:** Loading states, empty states, error alerts
✅ **Security:** Parameterized queries, CORS restrictions, XSS prevention
✅ **Configuration:** Environment variables instead of hardcoded URLs
✅ **Accessibility:** ARIA labels, keyboard navigation
✅ **Code Quality:** Modular, reusable components
✅ **Testing:** Error Boundary, validation testing

---

## Questions & Support

For questions or issues with implementation:
1. Refer to the CODE_AUDIT_REPORT.md
2. Check the specific component documentation in JSDoc comments
3. Review test cases in the Testing Checklist
4. Consult the Team for architecture decisions

---

**Last Updated:** April 19, 2026
**Status:** Ready for Implementation ✅
