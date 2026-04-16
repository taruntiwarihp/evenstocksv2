import React, { useState } from 'react';
import '../styles/StockChart.css';

/**
 * StockChart Component
 * Placeholder for stock price visualization
 *
 * Future enhancements:
 * - Integrate TradingView Lightweight Charts
 * - Add candlestick charts
 * - Add technical indicators (SMA, RSI, MACD, Bollinger Bands)
 * - Real-time price updates via WebSocket
 * - Multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d, 1w, 1M)
 * - Custom drawing tools
 * - Volume analysis
 * - Heatmaps for sector/stock correlation
 */

const StockChart = ({ stockSymbol = 'SAMPLE', stockName = 'Sample Stock', priceData = [] }) => {
  const [timeframe, setTimeframe] = useState('1d');
  const [chartType, setChartType] = useState('line');

  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];
  const chartTypes = ['line', 'candle', 'area', 'bar'];

  // Mock data for demonstration
  const mockChartData = Array.from({ length: 50 }, (_, i) => ({
    timestamp: new Date(Date.now() - (50 - i) * 3600000).toISOString(),
    open: 100 + Math.random() * 20,
    high: 110 + Math.random() * 20,
    low: 95 + Math.random() * 20,
    close: 100 + Math.random() * 20,
    volume: Math.floor(Math.random() * 1000000),
  }));

  const chartData = priceData.length > 0 ? priceData : mockChartData;

  const currentPrice = chartData[chartData.length - 1]?.close || 100;
  const previousPrice = chartData[0]?.close || 100;
  const priceChange = currentPrice - previousPrice;
  const priceChangePercent = ((priceChange / previousPrice) * 100).toFixed(2);

  return (
    <div className="stock-chart-container">
      <div className="chart-header">
        <div className="chart-title-section">
          <h3 className="chart-title">{stockName}</h3>
          <span className="chart-symbol">{stockSymbol}</span>
        </div>

        <div className="price-section">
          <div className="current-price">
            <span className="price-label">Price:</span>
            <span className="price-value">₹{currentPrice.toFixed(2)}</span>
          </div>
          <div className={`price-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
            <span className="change-value">
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}
            </span>
            <span className="change-percent">
              ({priceChangePercent}%)
            </span>
          </div>
        </div>
      </div>

      <div className="chart-controls">
        <div className="control-group">
          <label>Timeframe:</label>
          <div className="timeframe-buttons">
            {timeframes.map((tf) => (
              <button
                key={tf}
                className={`timeframe-btn ${timeframe === tf ? 'active' : ''}`}
                onClick={() => setTimeframe(tf)}
                disabled
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label>Chart Type:</label>
          <div className="chart-type-buttons">
            {chartTypes.map((type) => (
              <button
                key={type}
                className={`chart-type-btn ${chartType === type ? 'active' : ''}`}
                onClick={() => setChartType(type)}
                disabled
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-area">
        <div className="chart-placeholder">
          <div className="placeholder-content">
            <div className="placeholder-icon">📈</div>
            <h4>Stock Price Chart</h4>
            <p>Interactive charts with real-time price data</p>
            <div className="placeholder-details">
              <div className="detail-item">
                <span>Chart Type:</span>
                <strong>Line Chart (Placeholder)</strong>
              </div>
              <div className="detail-item">
                <span>Timeframe:</span>
                <strong>{timeframe}</strong>
              </div>
              <div className="detail-item">
                <span>Data Points:</span>
                <strong>{chartData.length}</strong>
              </div>
            </div>
            <div className="placeholder-message">
              ✨ Charts feature coming soon with TradingView integration
            </div>
          </div>
        </div>
      </div>

      <div className="chart-footer">
        <div className="chart-stats">
          <div className="stat">
            <span className="stat-label">High:</span>
            <span className="stat-value">
              ₹{Math.max(...chartData.map((d) => d.high)).toFixed(2)}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Low:</span>
            <span className="stat-value">
              ₹{Math.min(...chartData.map((d) => d.low)).toFixed(2)}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Avg Volume:</span>
            <span className="stat-value">
              {(chartData.reduce((sum, d) => sum + d.volume, 0) / chartData.length / 1000).toFixed(0)}K
            </span>
          </div>
        </div>
      </div>

      <div className="chart-info">
        <p className="info-text">
          💡 <strong>Note:</strong> This is a placeholder chart component. The actual implementation will include
          interactive TradingView Lightweight Charts with real-time data, technical indicators, and advanced drawing tools.
        </p>
      </div>
    </div>
  );
};

/**
 * StockChartAdvanced Component
 * For future advanced charting with indicators
 */
export const StockChartAdvanced = ({
  stockSymbol,
  indicators = ['SMA20', 'SMA50', 'RSI', 'MACD'],
  chartHeight = 400,
}) => {
  const [selectedIndicators, setSelectedIndicators] = useState(indicators);

  const toggleIndicator = (indicator) => {
    setSelectedIndicators((prev) =>
      prev.includes(indicator) ? prev.filter((i) => i !== indicator) : [...prev, indicator]
    );
  };

  return (
    <div className="stock-chart-advanced">
      <div className="advanced-header">
        <h4>Advanced Chart - {stockSymbol}</h4>
        <div className="indicator-controls">
          {['SMA20', 'SMA50', 'EMA12', 'RSI', 'MACD', 'BollingerBands'].map((ind) => (
            <button
              key={ind}
              className={`indicator-btn ${selectedIndicators.includes(ind) ? 'active' : ''}`}
              onClick={() => toggleIndicator(ind)}
            >
              {ind}
            </button>
          ))}
        </div>
      </div>

      <div className="advanced-chart-area" style={{ height: `${chartHeight}px` }}>
        <div className="advanced-placeholder">
          <div className="advanced-icon">🔧</div>
          <p>Advanced charting with {selectedIndicators.length} indicators</p>
          <div className="indicators-list">
            {selectedIndicators.map((ind) => (
              <span key={ind} className="indicator-badge">{ind}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="advanced-info">
        <p>
          🚀 Advanced charting features including technical indicators, trend analysis, and signal generation coming soon.
        </p>
      </div>
    </div>
  );
};

export default StockChart;
