const express = require('express');
const axios = require('axios');
const router = express.Router();

const API_BASE = process.env.EXTERNAL_API_BASE; // http://188.40.254.10:5809/api

// ─────────────────────────────────────────────────────────────
// CHATBOT API ENDPOINTS
// ─────────────────────────────────────────────────────────────

// Mock stock database (will be replaced with real DB)
const mockStocks = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', price: 2850, change: 1.2, volume: 2500000 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', price: 3950, change: 0.8, volume: 1200000 },
  { symbol: 'INFY', name: 'Infosys', price: 1820, change: -0.5, volume: 3400000 },
  { symbol: 'HDFC', name: 'HDFC Bank', price: 1680, change: 2.1, volume: 800000 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', price: 1120, change: 1.5, volume: 2100000 },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv', price: 1650, change: 0.9, volume: 600000 },
  { symbol: 'ITC', name: 'ITC Limited', price: 462, change: -0.3, volume: 4200000 },
  { symbol: 'SBIN', name: 'State Bank of India', price: 612, change: 1.8, volume: 5600000 },
  { symbol: 'MARUTI', name: 'Maruti Suzuki', price: 10250, change: 2.4, volume: 320000 },
  { symbol: 'WIPRO', name: 'Wipro', price: 475, change: -0.2, volume: 2800000 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', price: 920, change: 1.6, volume: 4500000 },
  { symbol: 'FORCEMOTORS', name: 'Force Motors', price: 2145, change: 0.5, volume: 180000 },
];

// ─────────────────────────────────────────────────────────────
// POST /api/chatbot
// Main endpoint for all chatbot operations
// ─────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { action, query, stocks = [], userId } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'Missing action parameter' });
  }

  try {
    switch (action) {

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // SEARCH STOCKS
      // POST /api/chatbot with { action: 'search_stocks', query: 'TCS' }
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'search_stocks': {
        if (!query || query.trim() === '') {
          return res.json({ results: [] });
        }

        const searchQuery = query.toLowerCase();
        const results = mockStocks.filter(
          (stock) =>
            stock.symbol.toLowerCase().includes(searchQuery) ||
            stock.name.toLowerCase().includes(searchQuery)
        );

        return res.json({
          success: true,
          results,
          count: results.length,
        });
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // GET STOCK DETAILS
      // POST /api/chatbot with { action: 'get_stock_details', query: 'TCS' }
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'get_stock_details': {
        if (!query) {
          return res.status(400).json({ error: 'Missing stock symbol' });
        }

        const stock = mockStocks.find(
          (s) => s.symbol.toLowerCase() === query.toLowerCase()
        );

        if (!stock) {
          return res.status(404).json({ error: 'Stock not found' });
        }

        // Generate mock detailed report
        const details = {
          ...stock,
          pe_ratio: (Math.random() * 30 + 10).toFixed(2),
          dividend_yield: (Math.random() * 3 + 0.5).toFixed(2),
          market_cap: `₹${(Math.random() * 500000 + 100000).toFixed(0)} Cr`,
          week_52_high: (stock.price * 1.3).toFixed(0),
          week_52_low: (stock.price * 0.7).toFixed(0),
          eps: (Math.random() * 100 + 10).toFixed(2),
          industry: 'Technology',
          description: `${stock.name} is a leading company in the Indian market.`,
          recent_news: [
            'Q4 Results beat expectations',
            'New project announcement',
            'Dividend declared at 20%',
          ],
        };

        return res.json({
          success: true,
          data: details,
        });
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // CHAT QUERY
      // POST /api/chatbot with { action: 'chat', query: 'Tell me about TCS' }
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'chat': {
        if (!query) {
          return res.status(400).json({ error: 'Missing query' });
        }

        // Simulate thinking stages
        const stages = [
          'Parsing your query',
          'Scanning financial databases',
          'Analyzing market trends',
          'Gathering insights',
        ];

        // Generate mock response
        const response = generateChatResponse(query, stocks);

        return res.json({
          success: true,
          response,
          stages,
          thinking_time: (Math.random() * 2 + 0.5).toFixed(2),
        });
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // EARNINGS TRACKER
      // POST /api/chatbot with { action: 'earnings_tracker' }
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'earnings_tracker': {
        const earnings = [
          { company: 'TCS', date: '2026-04-25', time: '14:30', market_cap_cr: 12000 },
          { company: 'INFOSYS', date: '2026-04-28', time: '15:00', market_cap_cr: 6500 },
          { company: 'WIPRO', date: '2026-05-02', time: '14:00', market_cap_cr: 2100 },
          { company: 'RELIANCE', date: '2026-05-05', time: '15:30', market_cap_cr: 18500 },
          { company: 'HDFC', date: '2026-05-08', time: '14:30', market_cap_cr: 8900 },
        ];

        return res.json({
          success: true,
          earnings,
          upcoming_count: earnings.length,
        });
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // SECTOR ANALYSIS
      // POST /api/chatbot with { action: 'sector_analysis' }
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'sector_analysis': {
        const sectors = [
          { name: 'IT', change: 1.5, stocks: ['TCS', 'INFY', 'WIPRO'], avg_pe: 22.5 },
          { name: 'Banking', change: 2.1, stocks: ['HDFC', 'ICICIBANK', 'SBIN'], avg_pe: 15.8 },
          { name: 'Auto', change: 0.8, stocks: ['MARUTI', 'BAJAJFINSV'], avg_pe: 18.2 },
          { name: 'FMCG', change: -0.3, stocks: ['ITC'], avg_pe: 28.5 },
          { name: 'Energy', change: 1.2, stocks: ['RELIANCE'], avg_pe: 12.3 },
        ];

        return res.json({
          success: true,
          sectors,
          analysis_date: new Date().toISOString().split('T')[0],
        });
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // SCREENER
      // POST /api/chatbot with { action: 'screener', criteria: 'pe_ratio < 20' }
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'screener': {
        const screened = mockStocks.map(stock => ({
          ...stock,
          pe_ratio: Math.random() * 30 + 10,
        })).filter(s => s.pe_ratio < 20);

        return res.json({
          success: true,
          results: screened,
          count: screened.length,
        });
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // MARKET MOVERS
      // POST /api/chatbot with { action: 'market_movers' }
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'market_movers': {
        const movers = mockStocks
          .map(stock => ({ ...stock, change: Math.random() * 10 - 5 }))
          .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
          .slice(0, 5);

        return res.json({
          success: true,
          gainers: movers.filter(m => m.change > 0),
          losers: movers.filter(m => m.change < 0),
        });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error(`[Chatbot/${action}] Error:`, error.message);
    return res.status(500).json({
      error: true,
      message: 'Failed to process chatbot request',
      details: error.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTION: Generate chat responses
// ─────────────────────────────────────────────────────────────
function generateChatResponse(query, stocks = []) {
  const lowerQuery = query.toLowerCase().trim();

  // Extract stock symbols from query (e.g., "TCS vs INFY" or "compare TCS and INFY")
  const stockSymbols = [];
  mockStocks.forEach(stock => {
    if (lowerQuery.includes(stock.symbol.toLowerCase()) || lowerQuery.includes(stock.name.toLowerCase())) {
      stockSymbols.push(stock);
    }
  });

  // Comparison queries
  if ((lowerQuery.includes('vs') || lowerQuery.includes('compare') || lowerQuery.includes('between')) && stockSymbols.length >= 2) {
    const stock1 = stockSymbols[0];
    const stock2 = stockSymbols[1];
    return `📊 **${stock1.symbol} vs ${stock2.symbol} Comparison**\n\n` +
      `**${stock1.symbol}** (${stock1.name})\n` +
      `Price: ₹${stock1.price} | Change: ${stock1.change > 0 ? '📈' : '📉'} ${stock1.change}%\n\n` +
      `**${stock2.symbol}** (${stock2.name})\n` +
      `Price: ₹${stock2.price} | Change: ${stock2.change > 0 ? '📈' : '📉'} ${stock2.change}%\n\n` +
      `**Analysis**: Both stocks show interesting trends. ${stock1.symbol} is currently ${stock1.change > stock2.change ? 'outperforming' : 'underperforming'} ${stock2.symbol} today.`;
  }

  // Single stock queries
  if (stockSymbols.length > 0) {
    const stock = stockSymbols[0];
    return `📊 **${stock.symbol} - ${stock.name}**\n\n` +
      `**Current Price**: ₹${stock.price}\n` +
      `**Today's Change**: ${stock.change > 0 ? '📈' : '📉'} ${stock.change}%\n` +
      `**Trading Volume**: ${(stock.volume / 1000000).toFixed(1)}M shares\n\n` +
      `The stock is currently trading at ₹${stock.price} with ${stock.change > 0 ? 'positive' : 'negative'} momentum.`;
  }

  // Stock-specific queries
  if (lowerQuery.includes('tell me about') || lowerQuery.includes('details') || lowerQuery.includes('show me')) {
    const stock = mockStocks[Math.floor(Math.random() * mockStocks.length)];
    return `📊 **${stock.name} (${stock.symbol})**\n\n` +
      `Current Price: ₹${stock.price}\n` +
      `Change: ${stock.change > 0 ? '📈' : '📉'} ${stock.change}%\n` +
      `Volume: ${(stock.volume / 1000000).toFixed(1)}M\n\n` +
      `The stock is trading at ₹${stock.price} with a ${stock.change}% change today.`;
  }

  // Trending stocks
  if (lowerQuery.includes('trending') || lowerQuery.includes('top stocks') || lowerQuery.includes('movers')) {
    return `📈 **Top Trending Stocks Today**\n\n` +
      `1. **MARUTI** - ↑ 2.4%\n` +
      `2. **HDFC** - ↑ 2.1%\n` +
      `3. **SBIN** - ↑ 1.8%\n` +
      `4. **TCS** - ↑ 1.5%\n` +
      `5. **RELIANCE** - ↑ 1.2%\n\n` +
      `The market is showing positive momentum today with auto and banking sectors leading.`;
  }

  // Portfolio queries
  if (lowerQuery.includes('portfolio') || lowerQuery.includes('my holdings')) {
    return `💼 **Your Portfolio Analysis**\n\n` +
      `**Total Value**: ₹2,45,000\n` +
      `**Today's Change**: +₹3,200 (+1.3%)\n` +
      `**Holdings**: 8 stocks\n\n` +
      `**Top Holdings**:\n` +
      `• TCS - 25% (₹61,250)\n` +
      `• HDFC - 22% (₹53,900)\n` +
      `• RELIANCE - 18% (₹44,100)\n\n` +
      `Your portfolio is well-diversified across IT and Banking sectors.`;
  }

  // Screening
  if (lowerQuery.includes('screen') || lowerQuery.includes('screener') || lowerQuery.includes('filter')) {
    return `🔍 **Stock Screener Results**\n\n` +
      `**Applied Filters**: PE Ratio < 20\n\n` +
      `**Found 7 Stocks**:\n` +
      `1. SBIN - PE: 14.2\n` +
      `2. HDFC - PE: 15.8\n` +
      `3. ITC - PE: 18.5\n` +
      `4. RELIANCE - PE: 12.3\n` +
      `5. MARUTI - PE: 16.9\n` +
      `6. INFY - PE: 19.2\n` +
      `7. WIPRO - PE: 17.4\n\n` +
      `These stocks offer good value at current market prices.`;
  }

  // Market analysis
  if (lowerQuery.includes('market') || lowerQuery.includes('analysis') || lowerQuery.includes('sector')) {
    return `📊 **Market Analysis**\n\n` +
      `**Overall Market**: Positive Momentum ↑\n\n` +
      `**Sector Performance**:\n` +
      `• IT Sector: +1.5% 📈\n` +
      `• Banking: +2.0% 📈\n` +
      `• Auto: +1.8% 📈\n` +
      `• FMCG: -0.3% 📉\n\n` +
      `**Key Insights**: Banks and IT companies are driving today's gains. Strong market sentiment.`;
  }

  // Buy/Sell recommendations
  if (lowerQuery.includes('buy') || lowerQuery.includes('sell') || lowerQuery.includes('should i')) {
    return `💡 **Investment Recommendation**\n\n` +
      `Based on current market trends:\n\n` +
      `**BUY**: IT & Banking stocks (TCS, HDFC, ICICIBANK)\n` +
      `**HOLD**: Auto sector (MARUTI, BAJAJFINSV)\n` +
      `**SELL**: Weak performers in FMCG\n\n` +
      `*Disclaimer: Always consult your financial advisor before making investment decisions.*`;
  }

  // Default response
  return `💡 **Market Update**\n\n` +
    `I'm analyzing your query: "${query}"\n\n` +
    `**Key Market Insights**:\n` +
    `• Market is showing positive momentum\n` +
    `• IT sector leading gains with +1.5%\n` +
    `• Banking stocks up by avg 2%\n` +
    `• Auto sector also performing well\n\n` +
    `**What would you like to know?**\n` +
    `• Compare specific stocks (e.g., "TCS vs INFY")\n` +
    `• View trending stocks\n` +
    `• Analyze your portfolio\n` +
    `• Screen stocks by criteria`;
}

module.exports = router;
