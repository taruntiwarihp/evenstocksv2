# Configuration file for API endpoints
# This should be used instead of hardcoding URLs in components

const getConfig = () => {
  return {
    API_BASE: process.env.REACT_APP_API_BASE || 'http://localhost:5000/api',
    WS_URL: process.env.REACT_APP_WS_URL || 'ws://localhost:8000',
    CHATBOT_API: process.env.REACT_APP_CHATBOT_API || 'http://localhost:8000',
    TIMEOUT: parseInt(process.env.REACT_APP_TIMEOUT || '30000'), // 30 seconds
    MAX_RETRIES: parseInt(process.env.REACT_APP_MAX_RETRIES || '3'),
    RETRY_BACKOFF: parseInt(process.env.REACT_APP_RETRY_BACKOFF || '1000'), // 1 second
  };
};

export default getConfig;
