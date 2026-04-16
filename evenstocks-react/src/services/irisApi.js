/**
 * Iris Chatbot API Handler
 * Placeholder for backend integration
 *
 * Backend API endpoints to be implemented:
 * - POST /api/iris/query - Send query and get analysis
 * - GET /api/iris/stocks - Search stocks (autocomplete)
 * - GET /api/iris/history/:userId - Get user's chat history
 * - DELETE /api/iris/history/:userId - Clear chat history
 */

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';
const WS_BASE_URL = process.env.REACT_APP_WS_BASE_URL || 'ws://localhost:8000';

/**
 * Send a query to the Iris chatbot and get analysis
 *
 * @param {string} query - The user's query
 * @param {string[]} selectedStocks - Array of selected stock symbols
 * @param {string} category - Category (market-explorer, market-pulse, deep-dive, investors-suite)
 * @returns {Promise<Object>} Analysis response with sources, timeline, and metrics
 *
 * Backend API contract:
 * POST /api/iris/query
 * {
 *   query: string,
 *   stocks: string[],
 *   category: string
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     stages: Array<{stage: string, icon: string}>,
 *     sources: {
 *       database: string[],
 *       files: string[],
 *       documents: string[]
 *     },
 *     analysis: {
 *       title: string,
 *       summary: string,
 *       whatStandsOut: string[],
 *       businessModel: string,
 *       recommendation: 'buy' | 'sell' | 'hold',
 *       confidenceLevel: number
 *     },
 *     metrics: {
 *       peRatio: number,
 *       dividendYield: number,
 *       debtToEquity: number,
 *       roe: number
 *     }
 *   },
 *   error?: string
 * }
 */
export const sendIrisQuery = async (query, selectedStocks = [], category = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/iris/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
      },
      body: JSON.stringify({
        query,
        stocks: selectedStocks,
        category,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending Iris query:', error);
    return {
      success: false,
      error: error.message || 'Failed to get analysis from Iris',
    };
  }
};

/**
 * Search for stocks with autocomplete
 *
 * @param {string} query - Stock name or symbol query
 * @returns {Promise<Array>} List of matching stocks
 *
 * Backend API contract:
 * GET /api/iris/stocks/search?q=query
 *
 * Response:
 * {
 *   success: boolean,
 *   data: Array<{
 *     stock_name: string,
 *     symbol: string,
 *     market_cap: string,
 *     current_price: number,
 *     stock_pe: number
 *   }>
 * }
 */
export const searchStocks = async (query) => {
  try {
    const response = await fetch(`${API_BASE_URL}/iris/stocks/search?q=${encodeURIComponent(query)}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error searching stocks:', error);
    return [];
  }
};

/**
 * Get user's chat history
 *
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of previous chat messages
 *
 * Backend API contract:
 * GET /api/iris/history/:userId
 *
 * Response:
 * {
 *   success: boolean,
 *   data: Array<{
 *     id: string,
 *     query: string,
 *     timestamp: string,
 *     category: string,
 *     stocks: string[]
 *   }>
 * }
 */
export const getChatHistory = async (userId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/iris/history/${userId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return [];
  }
};

/**
 * Clear user's chat history
 *
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 *
 * Backend API contract:
 * DELETE /api/iris/history/:userId
 *
 * Response:
 * {
 *   success: boolean,
 *   message: string
 * }
 */
export const clearChatHistory = async (userId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/iris/history/${userId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error clearing chat history:', error);
    return false;
  }
};

/**
 * WebSocket connection for real-time streaming responses
 *
 * @param {Function} onMessage - Callback for incoming messages
 * @param {Function} onError - Callback for errors
 * @returns {WebSocket} WebSocket instance
 *
 * Message types from server:
 * - stream_start: Analysis streaming has started
 * - stream_delta: Chunk of streamed content
 * - stream_end: Analysis streaming completed
 * - error: Error occurred during analysis
 *
 * Example usage:
 * const ws = connectIrisWebSocket(
 *   (msg) => { console.log(msg); },
 *   (error) => { console.error(error); }
 * );
 * ws.send(JSON.stringify({ action: 'query', query: 'Should I buy TCS?' }));
 */
export const connectIrisWebSocket = (onMessage, onError) => {
  try {
    const authToken = localStorage.getItem('auth_token');
    const url = `${WS_BASE_URL}/ws/iris${authToken ? `?token=${authToken}` : ''}`;

    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('Iris WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessage) onMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (onError) onError(error);
    };

    ws.onclose = () => {
      console.log('Iris WebSocket disconnected');
    };

    return ws;
  } catch (error) {
    console.error('Error connecting to Iris WebSocket:', error);
    if (onError) onError(error);
    return null;
  }
};

/**
 * Get real-time stock data for specific stocks
 *
 * @param {string[]} symbols - Array of stock symbols
 * @returns {Promise<Array>} Array of stock data with current prices
 *
 * Backend API contract:
 * POST /api/iris/stocks/data
 * {
 *   symbols: string[]
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   data: Array<{
 *     symbol: string,
 *     name: string,
 *     price: number,
 *     change: number,
 *     changePercent: number,
 *     volume: number,
 *     marketCap: string,
 *     peRatio: number
 *   }>
 * }
 */
export const getStockData = async (symbols) => {
  try {
    const response = await fetch(`${API_BASE_URL}/iris/stocks/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
      },
      body: JSON.stringify({ symbols }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching stock data:', error);
    return [];
  }
};

/**
 * Get analysis for a specific category
 *
 * @param {string} category - Category name (market-explorer, market-pulse, deep-dive, investors-suite)
 * @param {Object} filters - Optional filters for the category
 * @returns {Promise<Object>} Category-specific analysis data
 *
 * Backend API contract:
 * GET /api/iris/category/:categoryName?filters=json
 *
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     category: string,
 *     title: string,
 *     description: string,
 *     items: Array<Object>,
 *     summary: string
 *   }
 * }
 */
export const getCategoryAnalysis = async (category, filters = {}) => {
  try {
    const queryParams = new URLSearchParams(filters).toString();
    const url = `${API_BASE_URL}/iris/category/${category}${queryParams ? `?${queryParams}` : ''}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('Error fetching category analysis:', error);
    return null;
  }
};

export default {
  sendIrisQuery,
  searchStocks,
  getChatHistory,
  clearChatHistory,
  connectIrisWebSocket,
  getStockData,
  getCategoryAnalysis,
};
