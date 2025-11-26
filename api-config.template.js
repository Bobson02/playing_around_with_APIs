// Configuration file template for API keys
// Copy this file to api-config.js and add your actual API keys

const API_CONFIG = {
    // Alpha Vantage API for stock data
    // Get your free API key at: https://www.alphavantage.co/support/#api-key
    ALPHA_VANTAGE_KEY: 'YOUR_ALPHA_VANTAGE_KEY_HERE',
    ALPHA_VANTAGE_URL: 'https://www.alphavantage.co/query',
    
    // ExchangeRate-API for currency data (free tier doesn't require API key)
    EXCHANGE_RATE_URL: 'https://api.exchangerate-api.com/v4/latest',
    
    // NewsAPI for financial news
    // Get your free API key at: https://newsapi.org/register
    NEWS_API_KEY: 'YOUR_NEWS_API_KEY_HERE',
    NEWS_API_URL: 'https://newsapi.org/v2/everything'
};

// Export for use in main script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}
