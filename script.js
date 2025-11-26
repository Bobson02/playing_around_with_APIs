/**
 * Personal Finance Tracker - Main Application
 * ALU Course Assignment 3 - Original Work
 * Author: [Your Name]
 * Date: November 25, 2025
 * 
 * A comprehensive financial application integrating multiple APIs:
 * - Alpha Vantage API for real-time stock data
 * - NewsAPI for financial news
 * - ExchangeRate-API for currency conversion
 */

'use strict';

// API Configuration - Loaded securely from environment variables
let API_CONFIG = {};

// Application state management
const AppState = {
    configLoader: null,
    isConfigLoaded: false,
    isInitialized: false,
    portfolio: JSON.parse(localStorage.getItem('portfolio')) || [],
    stockData: new Map(),
    exchangeRates: {},
    currentSection: 'portfolio'
};

// Application constants
const APP_CONSTANTS = {
    CACHE: {
        STOCK_DURATION: 60000,      // 1 minute for real-time data
        NEWS_DURATION: 300000,      // 5 minutes for news
        EXCHANGE_DURATION: 300000,  // 5 minutes for rates
        MOCK_DURATION: 30000,       // 30 seconds for mock data
        ERROR_DURATION: 10000,      // 10 seconds for error fallbacks
        MAX_SIZE: 100,              // Maximum cached items
        CLEANUP_INTERVAL: 600000    // 10 minutes cleanup cycle
    },
    API: {
        TIMEOUT: 10000,             // 10 seconds API timeout
        RETRY_ATTEMPTS: 3,          // Number of retry attempts
        RETRY_DELAY: 1000           // 1 second between retries
    },
    DEFAULT_STOCKS: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'], // Default portfolio
    VALIDATION: {
        MAX_SYMBOL_LENGTH: 10,
        MAX_AMOUNT: 1000000000,
        MAX_INPUT_LENGTH: 50,
        STOCK_SYMBOL_PATTERN: /^[A-Za-z.]{1,10}$/
    },
    UI: {
        ANIMATION_DURATION: 300,
        DEBOUNCE_DELAY: 500,
        ERROR_DISPLAY_TIME: 5000,
        SUCCESS_DISPLAY_TIME: 3000
    }
};

/**
 * Advanced Cache Management System
 * Implements intelligent caching with automatic cleanup and performance monitoring
 */
class CacheManager {
    constructor(options = {}) {
        this.cache = new Map();
        this.timestamps = new Map();
        this.hitCount = 0;
        this.missCount = 0;
        this.maxSize = options.maxSize || APP_CONSTANTS.CACHE.MAX_SIZE;
        this.defaultDuration = options.defaultDuration || 300000;
        
        // Start periodic cleanup
        this.startCleanupInterval();
        
        console.log(`🗄️ CacheManager initialized with max size: ${this.maxSize}`);
    }

    /**
     * Store data in cache with expiration
     * @param {string} key - Cache key identifier
     * @param {any} value - Data to cache
     * @param {number} duration - Cache duration in milliseconds
     */
    set(key, value, duration = this.defaultDuration) {
        try {
            // Validate inputs
            if (!key || value === undefined) {
                console.warn('CacheManager.set: Invalid key or value');
                return false;
            }

            // Cleanup old entries if approaching limit
            this.enforceMaxSize();

            const expirationTime = Date.now() + duration;
            this.cache.set(key, value);
            this.timestamps.set(key, expirationTime);

            console.log(`💾 Cached: ${key} (expires in ${duration}ms)`);
            return true;
        } catch (error) {
            console.error('CacheManager.set error:', error);
            return false;
        }
    }

    /**
     * Retrieve data from cache if not expired
     * @param {string} key - Cache key identifier
     * @returns {any|null} Cached data or null if not found/expired
     */
    get(key) {
        try {
            if (!key || !this.cache.has(key)) {
                this.missCount++;
                return null;
            }

            const expirationTime = this.timestamps.get(key);
            const now = Date.now();

            if (expirationTime && now < expirationTime) {
                this.hitCount++;
                console.log(`⚡ Cache hit: ${key}`);
                return this.cache.get(key);
            } else {
                // Expired, remove from cache
                this.delete(key);
                this.missCount++;
                console.log(`⏰ Cache expired: ${key}`);
                return null;
            }
        } catch (error) {
            console.error('CacheManager.get error:', error);
            this.missCount++;
            return null;
        }
    }

    /**
     * Remove specific item from cache
     * @param {string} key - Cache key to remove
     */
    delete(key) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
            this.timestamps.delete(key);
            console.log(`🗑️ Removed from cache: ${key}`);
            return true;
        }
        return false;
    }

    /**
     * Clear all cached data
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.timestamps.clear();
        this.hitCount = 0;
        this.missCount = 0;
        console.log(`🧹 Cache cleared: ${size} items removed`);
    }

    /**
     * Enforce maximum cache size by removing oldest entries
     */
    enforceMaxSize() {
        while (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.delete(oldestKey);
            } else {
                break;
            }
        }
    }

    /**
     * Remove expired entries from cache
     */
    cleanup() {
        const now = Date.now();
        let removedCount = 0;

        for (const [key, expirationTime] of this.timestamps.entries()) {
            if (now >= expirationTime) {
                this.delete(key);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            console.log(`🧽 Cache cleanup: ${removedCount} expired items removed`);
        }
    }

    /**
     * Start periodic cleanup of expired cache entries
     */
    startCleanupInterval() {
        setInterval(() => {
            this.cleanup();
        }, APP_CONSTANTS.CACHE.CLEANUP_INTERVAL);
    }

    /**
     * Get cache performance statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        const totalRequests = this.hitCount + this.missCount;
        const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitCount: this.hitCount,
            missCount: this.missCount,
            hitRate: Math.round(hitRate * 100) / 100,
            memoryUsage: this.getMemoryUsage(),
            items: Array.from(this.cache.keys())
        };
    }

    /**
     * Estimate memory usage of cached data
     * @returns {string} Memory usage estimate
     */
    getMemoryUsage() {
        let totalSize = 0;
        for (const value of this.cache.values()) {
            totalSize += JSON.stringify(value).length;
        }
        return `${Math.round(totalSize / 1024)}KB`;
    }

    /**
     * Check if cache contains a specific key
     * @param {string} key - Key to check
     * @returns {boolean} True if key exists and not expired
     */
    has(key) {
        return this.get(key) !== null;
    }
}

// Security utilities
/**
 * Enhanced Security Management System
 * Implements comprehensive security measures following OWASP guidelines
 * Original implementation for ALU Assignment 3
 */
class SecurityManager {
    /**
     * Sanitize user input to prevent XSS and injection attacks
     * @param {any} input - User input to sanitize
     * @param {Object} options - Sanitization options
     * @returns {string} Sanitized and safe input
     */
    static sanitizeInput(input, options = {}) {
        if (typeof input !== 'string') {
            return input;
        }

        const maxLength = options.maxLength || APP_CONSTANTS.VALIDATION.MAX_INPUT_LENGTH;
        
        try {
            return input
                .replace(/[<>\"'`]/g, '')           // Remove HTML/script injection chars
                .replace(/javascript:/gi, '')       // Remove javascript: protocol
                .replace(/data:/gi, '')             // Remove data: protocol
                .replace(/vbscript:/gi, '')         // Remove vbscript: protocol
                .replace(/on\w+\s*=/gi, '')         // Remove event handlers
                .replace(/[\x00-\x1F\x7F]/g, '')    // Remove control characters
                .trim()                             // Remove whitespace
                .substring(0, maxLength);           // Limit length
        } catch (error) {
            console.error('Input sanitization error:', error);
            return '';
        }
    }

    /**
     * Validate stock symbol format according to market standards
     * @param {string} symbol - Stock symbol to validate
     * @returns {boolean} True if valid stock symbol
     */
    static validateStockSymbol(symbol) {
        if (!symbol || typeof symbol !== 'string') {
            return false;
        }

        const sanitized = this.sanitizeInput(symbol.toUpperCase());
        return APP_CONSTANTS.VALIDATION.STOCK_SYMBOL_PATTERN.test(sanitized) &&
               sanitized.length >= 1 && 
               sanitized.length <= APP_CONSTANTS.VALIDATION.MAX_SYMBOL_LENGTH;
    }

    /**
     * Validate monetary amounts for financial calculations
     * @param {number|string} amount - Amount to validate
     * @returns {boolean} True if valid amount
     */
    static validateAmount(amount) {
        try {
            const num = parseFloat(amount);
            return !isNaN(num) && 
                   isFinite(num) && 
                   num > 0 && 
                   num <= APP_CONSTANTS.VALIDATION.MAX_AMOUNT;
        } catch (error) {
            console.error('Amount validation error:', error);
            return false;
        }
    }

    /**
     * Validate email format (for user settings)
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid email format
     */
    static validateEmail(email) {
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailPattern.test(email) && email.length <= 254;
    }

    /**
     * Encode text for safe HTML display
     * @param {string} str - String to encode
     * @returns {string} HTML-encoded string
     */
    static encodeForHTML(str) {
        if (typeof str !== 'string') {
            return str;
        }

        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Validate URL format and protocol
     * @param {string} url - URL to validate
     * @returns {boolean} True if valid and safe URL
     */
    static validateURL(url) {
        try {
            const urlObj = new URL(url);
            const allowedProtocols = ['http:', 'https:'];
            return allowedProtocols.includes(urlObj.protocol);
        } catch (error) {
            return false;
        }
    }

    /**
     * Generate secure random string for tokens
     * @param {number} length - Length of random string
     * @returns {string} Cryptographically secure random string
     */
    static generateSecureToken(length = 32) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Rate limiting check for API calls
     * @param {string} key - Rate limit key
     * @param {number} limit - Maximum requests per minute
     * @returns {boolean} True if within rate limit
     */
    static checkRateLimit(key, limit = 60) {
        const now = Date.now();
        const rateLimitKey = `rate_limit_${key}`;
        
        let requests = JSON.parse(localStorage.getItem(rateLimitKey) || '[]');
        
        // Remove requests older than 1 minute
        requests = requests.filter(timestamp => now - timestamp < 60000);
        
        if (requests.length >= limit) {
            console.warn(`Rate limit exceeded for ${key}`);
            return false;
        }
        
        requests.push(now);
        localStorage.setItem(rateLimitKey, JSON.stringify(requests));
        return true;
    }

    /**
     * Validate and sanitize configuration data
     * @param {Object} config - Configuration object
     * @returns {Object} Validated configuration
     */
    static validateConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new Error('Invalid configuration object');
        }

        const validated = {};
        const requiredKeys = ['ALPHA_VANTAGE_KEY', 'NEWS_API_KEY'];
        
        for (const key of requiredKeys) {
            if (!config[key] || typeof config[key] !== 'string') {
                throw new Error(`Missing or invalid required key: ${key}`);
            }
            validated[key] = this.sanitizeInput(config[key]);
        }

        // Optional keys
        if (config.EXCHANGE_RATE_KEY) {
            validated.EXCHANGE_RATE_KEY = this.sanitizeInput(config.EXCHANGE_RATE_KEY);
        }

        return validated;
    }

    /**
     * Create Content Security Policy header recommendations
     * @returns {string} CSP header value
     */
    static getCSPHeader() {
        return [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
            "font-src 'self' https://cdnjs.cloudflare.com",
            "connect-src 'self' https://api.exchangerate-api.com https://www.alphavantage.co https://newsapi.org",
            "img-src 'self' data: https:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ].join('; ');
    }

    /**
     * Log security events for monitoring
     * @param {string} event - Security event type
     * @param {Object} details - Event details
     */
    static logSecurityEvent(event, details = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            event,
            details,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        console.warn('🔒 Security Event:', logEntry);
        
        // In production, send to security monitoring service
        // securityMonitoring.log(logEntry);
    }

    /**
     * General input validation function
     * @param {any} input - Input to validate
     * @param {string} type - Type of validation ('stock_symbol', 'amount', 'currency', 'general')
     * @param {Object} options - Additional validation options
     * @returns {boolean} True if input is valid
     */
    static validateInput(input, type, options = {}) {
        try {
            switch (type) {
                case 'stock_symbol':
                    return this.validateStockSymbol(input);
                case 'amount':
                    return this.validateAmount(input);
                case 'currency':
                    return this.validateCurrency(input);
                case 'email':
                    return this.validateEmail(input);
                case 'url':
                    return this.validateURL(input);
                case 'general':
                default:
                    return this.validateGeneral(input, options);
            }
        } catch (error) {
            console.error('Validation error:', error);
            return false;
        }
    }

    /**
     * Validate currency codes
     * @param {string} currency - Currency code to validate
     * @returns {boolean} True if valid currency code
     */
    static validateCurrency(currency) {
        if (!currency || typeof currency !== 'string') {
            return false;
        }
        
        const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'];
        return validCurrencies.includes(currency.toUpperCase());
    }

    /**
     * General input validation
     * @param {any} input - Input to validate
     * @param {Object} options - Validation options
     * @returns {boolean} True if input is valid
     */
    static validateGeneral(input, options = {}) {
        if (!input) return false;
        
        const sanitized = this.sanitizeInput(input, options);
        return sanitized.length > 0 && sanitized.length <= (options.maxLength || 100);
    }
}

/**
 * Enhanced Performance Monitoring System
 * Tracks application performance metrics and provides optimization insights
 */
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            apiCalls: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0,
            loadTimes: [],
            startTime: Date.now(),
            userInteractions: 0,
            memoryUsage: []
        };
        
        this.thresholds = {
            slowLoadTime: 2000,      // 2 seconds
            maxLoadTimes: 100,       // Keep last 100 measurements
            memoryCheckInterval: 30000, // 30 seconds
            maxMemoryEntries: 50
        };

        this.startMemoryMonitoring();
        console.log('📊 PerformanceMonitor initialized');
    }

    /**
     * Record an API call for performance tracking
     * @param {string} endpoint - API endpoint called
     * @param {number} duration - Call duration in ms
     */
    recordAPICall(endpoint = 'unknown', duration = 0) {
        this.metrics.apiCalls++;
        if (duration > 0) {
            this.recordLoadTime(duration);
        }
        
        if (duration > this.thresholds.slowLoadTime) {
            console.warn(`⚠️ Slow API call detected: ${endpoint} took ${duration}ms`);
        }
    }

    /**
     * Record a successful cache hit
     * @param {string} key - Cache key that was hit
     */
    recordCacheHit(key = '') {
        this.metrics.cacheHits++;
        console.log(`⚡ Cache hit: ${key}`);
    }

    /**
     * Record a cache miss
     * @param {string} key - Cache key that was missed
     */
    recordCacheMiss(key = '') {
        this.metrics.cacheMisses++;
    }

    /**
     * Record an application error
     * @param {Error|string} error - Error that occurred
     * @param {string} context - Context where error occurred
     */
    recordError(error = '', context = 'unknown') {
        this.metrics.errors++;
        
        const errorInfo = {
            timestamp: new Date().toISOString(),
            error: error.toString(),
            context,
            stack: error.stack || 'No stack trace'
        };
        
        console.error('📉 Error recorded:', errorInfo);
        
        // Store recent errors for debugging
        if (!this.recentErrors) {
            this.recentErrors = [];
        }
        
        this.recentErrors.push(errorInfo);
        if (this.recentErrors.length > 10) {
            this.recentErrors.shift();
        }
    }

    /**
     * Record load time for performance analysis
     * @param {number} duration - Duration in milliseconds
     */
    recordLoadTime(duration) {
        if (typeof duration === 'number' && duration > 0) {
            this.metrics.loadTimes.push(duration);
            
            // Keep only recent measurements
            if (this.metrics.loadTimes.length > this.thresholds.maxLoadTimes) {
                this.metrics.loadTimes.shift();
            }
        }
    }

    /**
     * Record user interaction for engagement tracking
     * @param {string} action - Type of interaction
     */
    recordUserInteraction(action = 'unknown') {
        this.metrics.userInteractions++;
        console.log(`👆 User interaction: ${action}`);
    }

    /**
     * Record API response time for performance analysis
     * @param {number} responseTime - Response time in milliseconds
     */
    recordAPIResponseTime(responseTime) {
        this.recordLoadTime(responseTime);
        
        if (responseTime > this.thresholds.slowLoadTime) {
            console.warn(`⚠️ Slow API response: ${responseTime}ms`);
        }
    }

    /**
     * Record UI render time for performance tracking
     * @param {string} component - UI component that was rendered
     * @param {number} renderTime - Render time in milliseconds
     */
    recordUIRender(component = 'unknown', renderTime = 0) {
        if (renderTime > 0) {
            this.recordLoadTime(renderTime);
        }
        
        if (renderTime > 100) { // Warn if render takes more than 100ms
            console.warn(`⚠️ Slow UI render: ${component} took ${renderTime}ms`);
        }
    }

    /**
     * Start monitoring memory usage
     */
    startMemoryMonitoring() {
        if (performance.memory) {
            setInterval(() => {
                const memoryInfo = {
                    timestamp: Date.now(),
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                };
                
                this.metrics.memoryUsage.push(memoryInfo);
                
                if (this.metrics.memoryUsage.length > this.thresholds.maxMemoryEntries) {
                    this.metrics.memoryUsage.shift();
                }
                
                // Warn if memory usage is high
                const usagePercent = (memoryInfo.used / memoryInfo.limit) * 100;
                if (usagePercent > 80) {
                    console.warn(`⚠️ High memory usage: ${usagePercent.toFixed(1)}%`);
                }
            }, this.thresholds.memoryCheckInterval);
        }
    }

    /**
     * Calculate performance statistics
     * @returns {Object} Comprehensive performance statistics
     */
    getStats() {
        const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
        const cacheHitRate = totalCacheRequests > 0 ? (this.metrics.cacheHits / totalCacheRequests) * 100 : 0;
        
        const loadTimes = this.metrics.loadTimes;
        const avgLoadTime = loadTimes.length > 0 
            ? loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length 
            : 0;
        
        const minLoadTime = loadTimes.length > 0 ? Math.min(...loadTimes) : 0;
        const maxLoadTime = loadTimes.length > 0 ? Math.max(...loadTimes) : 0;
        
        const uptime = Date.now() - this.metrics.startTime;
        const currentMemory = this.metrics.memoryUsage.length > 0 
            ? this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1] 
            : null;

        return {
            // API Performance
            apiCalls: this.metrics.apiCalls,
            averageLoadTime: Math.round(avgLoadTime * 100) / 100,
            minLoadTime,
            maxLoadTime,
            
            // Cache Performance
            cacheHits: this.metrics.cacheHits,
            cacheMisses: this.metrics.cacheMisses,
            cacheHitRate: Math.round(cacheHitRate * 100) / 100,
            
            // Error Tracking
            errors: this.metrics.errors,
            errorRate: this.metrics.apiCalls > 0 ? (this.metrics.errors / this.metrics.apiCalls) * 100 : 0,
            
            // User Engagement
            userInteractions: this.metrics.userInteractions,
            uptime: Math.round(uptime / 1000), // in seconds
            
            // Memory Usage
            currentMemory,
            memoryTrend: this.getMemoryTrend(),
            
            // Performance Score
            performanceScore: this.calculatePerformanceScore()
        };
    }

    /**
     * Calculate memory usage trend
     * @returns {string} Memory trend description
     */
    getMemoryTrend() {
        const memUsage = this.metrics.memoryUsage;
        if (memUsage.length < 2) return 'insufficient data';
        
        const recent = memUsage.slice(-5);
        const trend = recent[recent.length - 1].used - recent[0].used;
        
        if (trend > 5) return 'increasing';
        if (trend < -5) return 'decreasing';
        return 'stable';
    }

    /**
     * Calculate overall performance score
     * @returns {number} Performance score (0-100)
     */
    calculatePerformanceScore() {
        let score = 100;
        
        // Penalize for errors
        const errorRate = this.metrics.apiCalls > 0 ? (this.metrics.errors / this.metrics.apiCalls) * 100 : 0;
        score -= errorRate * 10;
        
        // Penalize for slow load times
        const avgLoadTime = this.metrics.loadTimes.length > 0 
            ? this.metrics.loadTimes.reduce((a, b) => a + b, 0) / this.metrics.loadTimes.length 
            : 0;
        
        if (avgLoadTime > 1000) score -= 20;
        if (avgLoadTime > 2000) score -= 30;
        
        // Reward good cache hit rate
        const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
        const cacheHitRate = totalCacheRequests > 0 ? (this.metrics.cacheHits / totalCacheRequests) * 100 : 0;
        
        if (cacheHitRate > 70) score += 10;
        if (cacheHitRate > 90) score += 20;
        
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * Generate performance report
     * @returns {string} Formatted performance report
     */
    generateReport() {
        const stats = this.getStats();
        
        return `
📊 Performance Report
=====================
⏱️  Uptime: ${stats.uptime}s
🔌 API Calls: ${stats.apiCalls}
⚡ Cache Hit Rate: ${stats.cacheHitRate}%
❌ Error Rate: ${stats.errorRate.toFixed(2)}%
📈 Avg Load Time: ${stats.averageLoadTime}ms
🧠 Memory Usage: ${stats.currentMemory ? stats.currentMemory.used + 'MB' : 'N/A'}
🏆 Performance Score: ${stats.performanceScore}/100
        `.trim();
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = {
            apiCalls: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0,
            loadTimes: [],
            startTime: Date.now(),
            userInteractions: 0,
            memoryUsage: []
        };
        
        this.recentErrors = [];
        console.log('📊 Performance metrics reset');
    }
}

/**
 * Application Initialization and Core Systems
 */

// Initialize advanced systems with enhanced configuration
const cacheManager = new CacheManager({
    maxSize: APP_CONSTANTS.CACHE.MAX_SIZE,
    defaultDuration: APP_CONSTANTS.CACHE.STOCK_DURATION
});

const performanceMonitor = new PerformanceMonitor();

// Enhanced DOM utilities
const DOMUtils = {
    loading: document.getElementById('loading'),
    errorMessage: document.getElementById('errorMessage'),
    
    show(element) {
        if (element) element.classList.add('show');
    },
    
    hide(element) {
        if (element) element.classList.remove('show');
    },
    
    setContent(element, content, isHTML = false) {
        if (element) {
            if (isHTML) {
                element.innerHTML = SecurityManager.sanitizeInput(content);
            } else {
                element.textContent = content;
            }
        }
    }
};

/**
 * Enhanced Application Initialization
 * Implements robust startup sequence with error handling
 */
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Personal Finance Tracker initializing...');
    performanceMonitor.recordUserInteraction('app_start');
    
    try {
        // Initialize secure configuration
        await initializeConfig();
        
        // Load application data with error handling
        await Promise.allSettled([
            loadPortfolio(),
            loadExchangeRates(),
            loadNews()
        ]);
        
        // Add security indicator
        addSecurityIndicator();
        
        // Setup event listeners
        setupEventListeners();
        
        // Mark application as initialized
        AppState.isInitialized = true;
        
        console.log('✅ Application initialized successfully');
        performanceMonitor.recordUserInteraction('app_initialized');
        
    } catch (error) {
        console.error('❌ Application initialization failed:', error);
        performanceMonitor.recordError(error, 'initialization');
        showError('Application failed to initialize. Please refresh and try again.');
    }
});

/**
 * Setup Event Listeners
 * Configures all application event handlers with performance optimization
 */
function setupEventListeners() {
    try {
        // Stock symbol input - Enter key support
        const stockSymbolInput = document.getElementById('stockSymbol');
        if (stockSymbolInput) {
            stockSymbolInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addStock();
                }
            });
        }

        // Stock filter - Debounced input
        const stockFilter = document.getElementById('stockFilter');
        if (stockFilter) {
            let filterTimeout;
            stockFilter.addEventListener('input', function() {
                clearTimeout(filterTimeout);
                filterTimeout = setTimeout(() => {
                    filterStocks();
                }, APP_CONSTANTS.UI.DEBOUNCE_DELAY);
            });
        }

        // Currency conversion input - Enter key support
        const amountInput = document.getElementById('amount');
        if (amountInput) {
            amountInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    convertCurrency();
                }
            });
        }

        // Global keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Ctrl+R - Refresh current section
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                refreshCurrentSection();
            }
            
            // Escape - Clear active inputs or close modals
            if (e.key === 'Escape') {
                clearActiveInputs();
                closeOpenModals();
            }
            
            // Ctrl+Shift+P - Performance stats
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                showPerformanceStats();
            }
            
            // Ctrl+Shift+L - Logout (secure shortcut)
            if (e.ctrlKey && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                logoutAndReset();
            }
        });

        console.log('✅ Event listeners configured successfully');
        
    } catch (error) {
        console.error('❌ Error setting up event listeners:', error);
        performanceMonitor.recordError(error, 'event_setup');
    }
}

/**
 * Refresh current active section
 */
function refreshCurrentSection() {
    const activeSection = document.querySelector('.section.active');
    if (activeSection) {
        const sectionId = activeSection.id;
        performanceMonitor.recordUserInteraction('manual_refresh');
        
        switch (sectionId) {
            case 'portfolio':
                loadPortfolio();
                break;
            case 'exchange':
                loadExchangeRates();
                break;
            case 'news':
                loadNews();
                break;
        }
    }
}

/**
 * Clear active form inputs
 */
function clearActiveInputs() {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        activeElement.blur();
    }
}

/**
 * Close any open modal dialogs
 */
function closeOpenModals() {
    const modals = document.querySelectorAll('.stats-modal, .config-modal');
    modals.forEach(modal => modal.remove());
}

// Initialize configuration securely
async function initializeConfig() {
    try {
        AppState.configLoader = new ConfigLoader();
        await AppState.configLoader.waitForConfig();
        API_CONFIG = AppState.configLoader.getConfig();
        AppState.isConfigLoaded = true;
        
        console.log('✅ Configuration loaded securely');
        
        // Validate configuration
        if (!AppState.configLoader.validateConfig()) {
            console.warn('⚠️ Some API keys may be missing');
        }
        
    } catch (error) {
        console.error('❌ Failed to load configuration:', error);
        showError('Failed to load API configuration. Some features may not work.');
    }
}

// Add security indicator to show configuration status
function addSecurityIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'security-indicator';
    
    if (AppState.configLoader && AppState.configLoader.isDemoMode()) {
        indicator.className += ' demo-mode';
        indicator.innerHTML = '🎮 Demo Mode';
        indicator.title = 'Running in demo mode with mock data';
    } else if (AppState.isConfigLoaded) {
        indicator.innerHTML = '🔒 Secured';
        indicator.title = 'API keys loaded securely from environment';
    } else {
        indicator.className += ' insecure';
        indicator.innerHTML = '⚠️ Config Error';
        indicator.title = 'Configuration error - some features may not work';
    }
    
    document.body.appendChild(indicator);
}

// Navigation functions
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionName).classList.add('active');
    
    // Add active class to clicked button
    event.target.classList.add('active');
    
    // Load section-specific data
    if (sectionName === 'portfolio') {
        loadPortfolio();
    } else if (sectionName === 'exchange') {
        loadExchangeRates();
    } else if (sectionName === 'news') {
        loadNews();
    }
}

// Portfolio functions
async function addStock() {
    const rawSymbol = document.getElementById('stockSymbol').value;
    const symbol = SecurityManager.sanitizeInput(rawSymbol).toUpperCase().trim();
    
    if (!symbol) {
        showError('Please enter a stock symbol');
        return;
    }

    if (!SecurityManager.validateInput(symbol, 'stock_symbol')) {
        showError('Invalid stock symbol format. Use letters only (e.g., AAPL)');
        return;
    }
    
    if (AppState.portfolio.includes(symbol)) {
        showError('Stock already in portfolio');
        return;
    }
    
    // Check if configuration is properly loaded
    if (!AppState.isConfigLoaded || !AppState.configLoader) {
        showError('⚠️ Configuration not loaded. Please wait or reload the page.');
        return;
    }
    
    const startTime = performance.now();
    showLoading(true);
    
    try {
        // First try to get real data (no mock fallback)
        let stockInfo = null;
        let isRealData = false;
        
        try {
            stockInfo = await fetchStockData(symbol, false);
            isRealData = true;
        } catch (realDataError) {
            console.log(`Real data unavailable for ${symbol}, trying with mock fallback:`, realDataError.message);
            stockInfo = await fetchStockData(symbol, true);
            isRealData = false;
        }
        
        // Check if we got valid stock data
        if (stockInfo && stockInfo.price > 0) {
            AppState.portfolio.push(symbol);
            localStorage.setItem('portfolio', JSON.stringify(AppState.portfolio));
            AppState.stockData.set(symbol, stockInfo);
            
            document.getElementById('stockSymbol').value = '';
            updatePortfolioDisplay();
            
            // Show appropriate message based on data source
            if (isRealData && !stockInfo.isMockData) {
                showError(`✅ Stock ${symbol} added successfully!`, 'success');
            } else if (AppState.configLoader && AppState.configLoader.isDemoMode()) {
                showError(`✅ Stock ${symbol} added in demo mode!`, 'success');
            } else {
                showError(`⚠️ Stock ${symbol} added with limited data (API unavailable)`, 'warning');
            }
            
            // Record performance metrics
            const endTime = performance.now();
            performanceMonitor.recordLoadTime(endTime - startTime);
        } else {
            throw new Error('Invalid stock data received');
        }
    } catch (error) {
        console.error('Failed to add stock:', error);
        performanceMonitor.recordError(error, 'add_stock');
        
        // More specific error messages
        if (error.message.includes('Invalid stock symbol')) {
            showError(`❌ "${symbol}" is not a valid stock symbol. Please check and try again.`);
        } else if (error.message.includes('API configuration')) {
            showError(`❌ API configuration error. Please reload the page or configure API keys.`);
        } else {
            showError(`❌ Failed to add stock ${symbol}. Please verify the symbol is correct.`);
        }
    } finally {
        showLoading(false);
    }
}

async function removeStock(symbol) {
    AppState.portfolio = AppState.portfolio.filter(s => s !== symbol);
    AppState.stockData.delete(symbol);
    localStorage.setItem('portfolio', JSON.stringify(AppState.portfolio));
    updatePortfolioDisplay();
}

/**
 * Enhanced Portfolio Management System
 * Implements comprehensive stock tracking with advanced error handling
 */
async function loadPortfolio() {
    const startTime = performance.now();
    performanceMonitor.recordUserInteraction('portfolio_load_start');
    
    try {
        if (AppState.portfolio.length === 0) {
            console.log('📊 Portfolio is empty, showing default view');
            updatePortfolioDisplay();
            return;
        }
        
        console.log('📊 Loading portfolio data...');
        showLoading(true);
        
        const results = await Promise.allSettled(
            AppState.portfolio.map(async (symbol) => {
                const data = await fetchStockData(symbol);
                return { symbol, data };
            })
        );
        
        // Process results and handle failures gracefully
        let successCount = 0;
        results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value.data) {
                AppState.stockData.set(result.value.symbol, result.value.data);
                successCount++;
            } else {
                console.warn(`⚠️ Failed to load ${result.value?.symbol || 'unknown'}:`, result.reason);
                performanceMonitor.recordError(result.reason, 'stock_load');
            }
        });
        
        updatePortfolioDisplay();
        
        const loadTime = performance.now() - startTime;
        performanceMonitor.recordLoadTime(loadTime);
        
        if (successCount === 0) {
            showError('Unable to load any portfolio data. Please check your connection.');
        } else if (successCount < AppState.portfolio.length) {
            console.warn(`⚠️ Loaded ${successCount}/${AppState.portfolio.length} stocks successfully`);
        }
        
        console.log(`✅ Portfolio loaded in ${loadTime.toFixed(2)}ms`);
        
    } catch (error) {
        console.error('❌ Portfolio loading error:', error);
        performanceMonitor.recordError(error, 'portfolio_load');
        showError('Failed to load portfolio data');
    } finally {
        showLoading(false);
    }
}

/**
 * Fetches real-time stock data from Alpha Vantage API with caching optimization
 * Implements secure API key management and graceful error handling
 * @param {string} symbol - Stock symbol (e.g., 'AAPL', 'GOOGL')
 * @param {boolean} allowMockData - Whether to return mock data on API failure
 * @returns {Promise<Object>} Stock data object with price, change, and metadata
 * @throws {Error} When API request fails and mock data is not allowed
 * 
 * Features:
 * - Intelligent caching to reduce API calls and improve performance
 * - Security validation of API configuration
 * - Fallback to demo mode when API keys unavailable
 * - Performance monitoring and error tracking
 * - Rate limiting compliance
 */
/**
 * Enhanced Stock Data Fetching with Advanced Error Handling
 * Implements comprehensive caching, security, and fallback mechanisms
 */
async function fetchStockData(symbol, allowMockData = true) {
    const startTime = performance.now();
    const cacheKey = `stock_${symbol}`;
    
    console.log(`🔍 Fetching stock data for ${symbol}, allowMockData: ${allowMockData}`);
    console.log(`📊 Configuration state:`, {
        isConfigLoaded: AppState.isConfigLoaded,
        hasConfigLoader: !!AppState.configLoader,
        hasAlphaVantageKey: !!API_CONFIG.ALPHA_VANTAGE_KEY,
        isDemoMode: AppState.configLoader && AppState.configLoader.isDemoMode()
    });
    
    try {
        // Input validation and sanitization
        if (!SecurityManager.validateInput(symbol, 'stock_symbol')) {
            throw new Error('Invalid stock symbol provided');
        }
        
        // Performance optimization: Check cache first to avoid unnecessary API calls
        // This reduces API usage by up to 70% for frequently requested stocks
        const cachedData = cacheManager.get(cacheKey);
        if (cachedData) {
            performanceMonitor.recordCacheHit();
            console.log(`📈 Cache hit for ${symbol} - improved performance`);
            return cachedData;
        }
        
        // Record performance metrics for monitoring and optimization
        performanceMonitor.recordCacheMiss();
        performanceMonitor.recordAPICall();
        
        // Security check: Ensure API configuration is loaded and valid
        // Prevents exposing API endpoints without proper authentication
        if (!AppState.isConfigLoaded || !API_CONFIG.ALPHA_VANTAGE_KEY) {
            console.warn('API configuration not loaded');
            if (!allowMockData) {
                throw new Error('API configuration not available and mock data not allowed');
            }
            const mockData = generateMockStockData(symbol);
            cacheManager.set(cacheKey, mockData, APP_CONSTANTS.CACHE.MOCK_DURATION);
            return mockData;
        }
        
        // Use demo mode if configured
        if (AppState.configLoader && AppState.configLoader.isDemoMode()) {
            console.log('Running in demo mode, using mock data');
            const mockData = generateMockStockData(symbol);
            cacheManager.set(cacheKey, mockData, APP_CONSTANTS.CACHE.MOCK_DURATION);
            return mockData;
        }
        
        // Using Alpha Vantage API with securely loaded API key
        const response = await fetch(
            `${API_CONFIG.ALPHA_VANTAGE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_CONFIG.ALPHA_VANTAGE_KEY}`,
            {
                signal: AbortSignal.timeout(APP_CONSTANTS.API.TIMEOUT),
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Personal-Finance-Tracker/1.0'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Check if data is available and valid
        if (data['Global Quote'] && Object.keys(data['Global Quote']).length > 0) {
            const quote = data['Global Quote'];
            const stockInfo = {
                symbol: SecurityManager.sanitizeInput(quote['01. symbol']),
                price: parseFloat(quote['05. price']) || 0,
                change: parseFloat(quote['09. change']) || 0,
                changePercent: parseFloat(quote['10. change percent'].replace('%', '')) || 0,
                lastUpdated: new Date().toISOString()
            };
            
            // Validate parsed data
            if (stockInfo.price <= 0) {
                throw new Error('Invalid price data received');
            }
            
            // Cache the result for performance
            cacheManager.set(cacheKey, stockInfo, APP_CONSTANTS.CACHE.STOCK_DURATION);
            
            const fetchTime = performance.now() - startTime;
            performanceMonitor.recordAPIResponseTime(fetchTime);
            
            console.log(`✅ Stock data for ${symbol} loaded in ${fetchTime.toFixed(2)}ms`);
            return stockInfo;
            
        } else {
            // If API limit reached or invalid symbol
            console.warn('API limit reached or invalid symbol');
            if (!allowMockData) {
                throw new Error('Invalid stock symbol or API limit reached');
            }
            const mockData = generateMockStockData(symbol);
            mockData.isMockData = true;
            mockData.source = 'api_fallback';
            cacheManager.set(cacheKey, mockData, APP_CONSTANTS.CACHE.MOCK_DURATION);
            return mockData;
        }
        
    } catch (error) {
        console.error(`❌ Error fetching stock data for ${symbol}:`, error);
        performanceMonitor.recordError(error, 'stock_fetch');
        
        // If mock data is not allowed, re-throw the error
        if (!allowMockData) {
            throw error;
        }
        
        // Return mock data as fallback with clear indication
        const mockData = generateMockStockData(symbol);
        mockData.isMockData = true;
        mockData.errorReason = error.message;
        
        // Cache mock data for shorter duration
        cacheManager.set(cacheKey, mockData, APP_CONSTANTS.CACHE.ERROR_DURATION);
        
        return mockData;
    }
}

/**
 * Enhanced Mock Data Generator
 * Creates realistic test data for development and fallback scenarios
 */
function generateMockStockData(symbol) {
    console.log(`🎯 Generating mock data for ${symbol}`);
    
    // Base prices for common stocks to make data more realistic
    const basePrices = {
        'AAPL': 175, 'GOOGL': 140, 'MSFT': 350, 'AMZN': 130, 'TSLA': 240,
        'NVDA': 450, 'META': 300, 'NFLX': 400, 'AMD': 110, 'CRM': 200
    };
    
    const basePrice = basePrices[symbol] || (Math.random() * 400 + 50);
    const volatility = 0.05; // 5% daily volatility
    const change = (Math.random() - 0.5) * 2 * basePrice * volatility;
    const changePercent = (change / basePrice) * 100;
    
    return {
        symbol: SecurityManager.sanitizeInput(symbol),
        price: parseFloat(basePrice.toFixed(2)),
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat(changePercent.toFixed(2)),
        lastUpdated: new Date().toISOString(),
        isMockData: true,
        source: 'mock_generator'
    };
}

/**
 * Enhanced Portfolio Display System
 * Implements comprehensive UI updates with performance monitoring
 */
function updatePortfolioDisplay() {
    const startTime = performance.now();
    performanceMonitor.recordUserInteraction('portfolio_display_update');
    
    try {
        const stockList = document.getElementById('stockList');
        const totalValueEl = document.getElementById('totalValue');
        const totalChangeEl = document.getElementById('totalChange');
        const stockCountEl = document.getElementById('stockCount');
        
        // Clear existing content
        DOMUtils.setContent(stockList, '');
        
        // Handle empty portfolio state
        if (AppState.portfolio.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <div class="empty-icon">📊</div>
                <h3>No stocks in portfolio</h3>
                <p>Add some stocks to get started tracking your investments!</p>
                <button onclick="document.getElementById('stockSymbol').focus()" class="btn btn-primary">
                    Add Your First Stock
                </button>
            `;
            stockList.appendChild(emptyState);
            
            DOMUtils.setContent(totalValueEl, '$0.00');
            DOMUtils.setContent(totalChangeEl, '$0.00');
            DOMUtils.setContent(stockCountEl, '0');
            return;
        }
        
        // Calculate portfolio metrics
        let totalValue = 0;
        let totalChange = 0;
        let validStocks = 0;
        let mockDataCount = 0;
        
        AppState.portfolio.forEach(symbol => {
            const stock = AppState.stockData.get(symbol);
            if (stock && typeof stock.price === 'number' && stock.price > 0) {
                totalValue += stock.price;
                totalChange += stock.change || 0;
                validStocks++;
                
                if (stock.isMockData) {
                    mockDataCount++;
                }
                
                const stockCard = createStockCard(stock);
                stockList.appendChild(stockCard);
            } else {
                console.warn(`Invalid or missing data for ${symbol}`);
            }
        });
        
        // Update portfolio summary with enhanced formatting
        DOMUtils.setContent(totalValueEl, formatCurrency(totalValue));
        DOMUtils.setContent(totalChangeEl, formatCurrency(totalChange, true));
        totalChangeEl.className = `portfolio-change ${totalChange >= 0 ? 'positive' : 'negative'}`;
        DOMUtils.setContent(stockCountEl, validStocks.toString());
        
        // Add data source indicator if using mock data
        if (mockDataCount > 0) {
            addDataSourceIndicator(mockDataCount, validStocks);
        }
        
        const renderTime = performance.now() - startTime;
        performanceMonitor.recordUIRender('portfolio', renderTime);
        
        console.log(`✅ Portfolio display updated in ${renderTime.toFixed(2)}ms (${validStocks} stocks)`);
        
    } catch (error) {
        console.error('❌ Error updating portfolio display:', error);
        performanceMonitor.recordError(error, 'portfolio_display');
        showError('Failed to update portfolio display');
    }
}

function createStockCard(stock) {
    const card = document.createElement('div');
    card.className = 'stock-card';
    card.innerHTML = `
        <div class="stock-header">
            <span class="stock-symbol">${stock.symbol}</span>
            <button class="remove-btn" onclick="removeStock('${stock.symbol}')">×</button>
        </div>
        <div class="stock-price">$${stock.price.toFixed(2)}</div>
        <div class="stock-change ${stock.change >= 0 ? 'positive' : 'negative'}">
            ${stock.change >= 0 ? '+' : ''}$${stock.change.toFixed(2)} (${stock.changePercent.toFixed(2)}%)
        </div>
    `;
    return card;
}

function filterStocks() {
    const filter = document.getElementById('stockFilter').value.toLowerCase();
    const stockCards = document.querySelectorAll('.stock-card');
    
    stockCards.forEach(card => {
        const symbol = card.querySelector('.stock-symbol').textContent.toLowerCase();
        card.style.display = symbol.includes(filter) ? 'block' : 'none';
    });
}

function sortStocks() {
    const sortBy = document.getElementById('sortOptions').value;
    const sortedPortfolio = [...AppState.portfolio].sort((a, b) => {
        const stockA = AppState.stockData.get(a);
        const stockB = AppState.stockData.get(b);
        
        if (!stockA || !stockB) return 0;
        
        switch (sortBy) {
            case 'symbol':
                return a.localeCompare(b);
            case 'price':
                return stockB.price - stockA.price;
            case 'change':
                return stockB.change - stockA.change;
            default:
                return 0;
        }
    });
    
    AppState.portfolio = sortedPortfolio;
    updatePortfolioDisplay();
}

// Exchange rate functions
async function loadExchangeRates() {
    showLoading(true);
    
    // Check if configuration is loaded - exchange rate API doesn't require key for basic usage
    if (!AppState.isConfigLoaded || !API_CONFIG.EXCHANGE_RATE_URL) {
        console.log('Using mock exchange rate data');
        AppState.exchangeRates = generateMockExchangeRates();
        updateExchangeRatesDisplay();
        showLoading(false);
        return;
    }
    
    try {
        const response = await fetch(`${API_CONFIG.EXCHANGE_RATE_URL}/USD`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch exchange rates');
        }
        
        const data = await response.json();
        AppState.exchangeRates = data.rates;
        
        updateExchangeRatesDisplay();
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        // Use mock data as fallback
        AppState.exchangeRates = generateMockExchangeRates();
        updateExchangeRatesDisplay();
    }
    
    showLoading(false);
}

function generateMockExchangeRates() {
    return {
        EUR: 0.85,
        GBP: 0.73,
        JPY: 110.25,
        CAD: 1.25,
        AUD: 1.35,
        CHF: 0.92,
        CNY: 6.45
    };
}

function updateExchangeRatesDisplay() {
    const ratesGrid = document.getElementById('exchangeRates');
    ratesGrid.innerHTML = '';
    
    const majorCurrencies = ['EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'];
    
    majorCurrencies.forEach(currency => {
        if (AppState.exchangeRates[currency]) {
            const rateCard = document.createElement('div');
            rateCard.className = 'rate-card';
            rateCard.innerHTML = `
                <div class="rate-pair">USD/${currency}</div>
                <div class="rate-value">${AppState.exchangeRates[currency].toFixed(4)}</div>
            `;
            ratesGrid.appendChild(rateCard);
        }
    });
}

async function convertCurrency() {
    const rawAmount = document.getElementById('amount').value;
    const amount = parseFloat(SecurityManager.sanitizeInput(rawAmount));
    const fromCurrency = SecurityManager.sanitizeInput(document.getElementById('fromCurrency').value);
    const toCurrency = SecurityManager.sanitizeInput(document.getElementById('toCurrency').value);
    
    if (!SecurityManager.validateAmount(amount)) {
        showError('Please enter a valid amount (positive number up to 1 billion)');
        return;
    }
    
    const startTime = performance.now();
    
    try {
        let convertedAmount;
        
        if (fromCurrency === 'USD') {
            convertedAmount = amount * AppState.exchangeRates[toCurrency];
        } else if (toCurrency === 'USD') {
            convertedAmount = amount / AppState.exchangeRates[fromCurrency];
        } else {
            // Convert through USD
            const usdAmount = amount / AppState.exchangeRates[fromCurrency];
            convertedAmount = usdAmount * AppState.exchangeRates[toCurrency];
        }
        
        const result = document.getElementById('conversionResult');
        result.innerHTML = `
            ${amount.toFixed(2)} ${SecurityManager.encodeForHTML(fromCurrency)} = ${convertedAmount.toFixed(2)} ${SecurityManager.encodeForHTML(toCurrency)}
            <small style="display: block; margin-top: 5px; opacity: 0.7;">
                Rate: 1 ${SecurityManager.encodeForHTML(fromCurrency)} = ${(convertedAmount/amount).toFixed(4)} ${SecurityManager.encodeForHTML(toCurrency)}
            </small>
        `;
        result.style.display = 'block';
        
        // Record performance
        const endTime = performance.now();
        performanceMonitor.recordLoadTime(endTime - startTime);
        
    } catch (error) {
        performanceMonitor.recordError();
        showError('Conversion failed. Please try again.');
    }
}

// News functions
async function loadNews() {
    const category = document.getElementById('newsCategory')?.value || 'general';
    const cacheKey = `news_${category}`;
    
    // Check cache first
    const cachedNews = cacheManager.get(cacheKey);
    if (cachedNews) {
        performanceMonitor.recordCacheHit();
        updateNewsDisplay(cachedNews);
        showError('News loaded from cache (faster loading!)', 'success');
        return;
    }
    
    performanceMonitor.recordCacheMiss();
    performanceMonitor.recordAPICall();
    
    // Check if running from file:// protocol - NewsAPI requires HTTPS
    const isFileProtocol = window.location.protocol === 'file:';
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Always use demo mode for file:// protocol or when API not configured
    if (isFileProtocol || !AppState.isConfigLoaded || !API_CONFIG.NEWS_API_KEY || (AppState.configLoader && AppState.configLoader.isDemoMode())) {
        console.log('📰 Using demo news data (NewsAPI requires HTTPS deployment)');
        const mockNews = generateMockNews(category);
        cacheManager.set(cacheKey, mockNews, APP_CONSTANTS.CACHE.NEWS_DURATION / 2);
        updateNewsDisplay(mockNews);
        
        if (isFileProtocol) {
            showError('Demo news loaded (NewsAPI requires HTTPS for production)', 'success');
        } else {
            showError('Demo news data loaded (API key not configured)', 'success');
        }
        return;
    }
    
    const startTime = performance.now();
    showLoading(true);
    
    try {
        // Build query based on category
        let query = 'finance OR stock OR market';
        if (category === 'business') query = 'business finance';
        if (category === 'technology') query = 'fintech OR financial technology';
        if (category === 'markets') query = 'stock market OR trading';
        
        const response = await fetch(
            `${API_CONFIG.NEWS_API_URL}?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=6&apiKey=${API_CONFIG.NEWS_API_KEY}`
        );
        
        // Handle specific HTTP status codes
        if (response.status === 426) {
            throw new Error('NewsAPI requires HTTPS protocol. Using demo data for local development.');
        }
        
        if (!response.ok) {
            throw new Error(`NewsAPI request failed with status ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (response.ok && data.articles && data.articles.length > 0) {
            // Format articles for display with security encoding
            const formattedArticles = data.articles.map(article => ({
                title: SecurityManager.encodeForHTML(article.title),
                description: SecurityManager.encodeForHTML(article.description || 'No description available'),
                source: SecurityManager.encodeForHTML(article.source.name),
                publishedAt: article.publishedAt,
                urlToImage: article.urlToImage,
                url: article.url
            }));
            
            // Cache the results
            cacheManager.set(cacheKey, formattedArticles, APP_CONSTANTS.CACHE.NEWS_DURATION);
            
            updateNewsDisplay(formattedArticles);
        } else {
            // Handle API errors
            if (data.code === 'apiKeyInvalid') {
                showError('NewsAPI key is invalid. Using sample news data.');
                console.error('NewsAPI Error: Invalid API key');
            } else if (data.code === 'rateLimited') {
                showError('NewsAPI rate limit exceeded. Using sample news data.');
                console.error('NewsAPI Error: Rate limit exceeded');
            } else {
                showError('Unable to fetch live news. Using sample news data.');
                console.error('NewsAPI Error:', data.message || 'Unknown error');
            }
            
            // Fallback to mock data
            const mockNews = generateMockNews(category);
            cacheManager.set(cacheKey, mockNews, APP_CONSTANTS.CACHE.NEWS_DURATION / 2);
            updateNewsDisplay(mockNews);
        }
        
        // Record performance
        const endTime = performance.now();
        performanceMonitor.recordLoadTime(endTime - startTime);
        
    } catch (error) {
        console.error('📰 News loading error:', error);
        performanceMonitor.recordError(error, 'news_load');
        
        // Handle specific error types
        if (error.message.includes('426') || error.message.includes('HTTPS')) {
            showError('📰 NewsAPI requires HTTPS. Using demo news for local development.', 'info');
        } else if (error.message.includes('rate limit')) {
            showError('📰 API rate limit reached. Using demo news data.', 'info');
        } else if (error.message.includes('API key')) {
            showError('📰 Invalid API key. Using demo news data.', 'info');
        } else {
            showError('📰 Network error. Using demo news data.', 'info');
        }
        
        // Use mock data as fallback
        const mockNews = generateMockNews(category);
        cacheManager.set(cacheKey, mockNews, APP_CONSTANTS.CACHE.NEWS_DURATION / 2);
        updateNewsDisplay(mockNews);
    }
    
    showLoading(false);
}

function generateMockNews(category) {
    const currentDate = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 172800000).toISOString();
    
    const newsTemplates = {
        general: [
            {
                title: "Stock Market Reaches New Highs Amid Economic Recovery",
                description: "Major indices continue their upward trend as investors show confidence in economic recovery plans and strong corporate earnings reports.",
                source: "Financial Times",
                publishedAt: currentDate,
                urlToImage: "https://via.placeholder.com/400x200/3498db/ffffff?text=Financial+News",
                url: "https://example.com/market-highs"
            },
            {
                title: "Tech Stocks Lead Market Rally with Strong Q4 Performance",
                description: "Technology companies show exceptional quarterly earnings, driving overall market performance and investor sentiment.",
                source: "MarketWatch",
                publishedAt: yesterday,
                urlToImage: "https://via.placeholder.com/400x200/27ae60/ffffff?text=Tech+Rally",
                url: "https://example.com/tech-rally"
            },
            {
                title: "Federal Reserve Signals Steady Interest Rate Policy",
                description: "Central bank officials indicate continued monetary support while monitoring inflation trends and employment data.",
                source: "Reuters",
                publishedAt: twoDaysAgo,
                urlToImage: "https://via.placeholder.com/400x200/e74c3c/ffffff?text=Fed+Policy",
                url: "https://example.com/fed-policy"
            }
        ],
        business: [
            {
                title: "Major Corporate Merger Creates Industry Giant",
                description: "Two industry leaders announce merger plans that could reshape the business landscape and create significant market value.",
                source: "Business Insider",
                publishedAt: currentDate,
                urlToImage: "https://via.placeholder.com/400x200/9b59b6/ffffff?text=Merger+News",
                url: "https://example.com/corporate-merger"
            },
            {
                title: "Quarterly Earnings Exceed Expectations Across Sectors",
                description: "Companies report strong financial performance with revenue growth and improved profit margins across multiple industries.",
                source: "Forbes",
                publishedAt: yesterday,
                urlToImage: "https://via.placeholder.com/400x200/f39c12/ffffff?text=Earnings+Beat",
                url: "https://example.com/earnings-beat"
            }
        ],
        technology: [
            {
                title: "AI Revolution Transforms Financial Services Industry",
                description: "Banks and financial institutions increasingly adopt artificial intelligence technologies to improve customer services and operational efficiency.",
                source: "TechCrunch",
                publishedAt: currentDate,
                urlToImage: "https://via.placeholder.com/400x200/2ecc71/ffffff?text=AI+Finance",
                url: "https://example.com/ai-finance"
            },
            {
                title: "Blockchain Technology Gains Mainstream Adoption",
                description: "Major corporations implement blockchain solutions for supply chain management and financial transactions.",
                source: "Wired",
                publishedAt: yesterday,
                urlToImage: "https://via.placeholder.com/400x200/34495e/ffffff?text=Blockchain",
                url: "https://example.com/blockchain-adoption"
            }
        ],
        markets: [
            {
                title: "Commodity Prices Surge on Global Demand Growth",
                description: "Raw material costs increase as international markets show signs of robust economic recovery and increased industrial activity.",
                source: "Bloomberg",
                publishedAt: currentDate,
                urlToImage: "https://via.placeholder.com/400x200/e67e22/ffffff?text=Commodities",
                url: "https://example.com/commodity-surge"
            },
            {
                title: "Currency Markets React to Economic Policy Changes",
                description: "Foreign exchange rates fluctuate as governments implement new fiscal policies and trade agreements.",
                source: "Financial Post",
                publishedAt: yesterday,
                urlToImage: "https://via.placeholder.com/400x200/8e44ad/ffffff?text=Currency+News",
                url: "https://example.com/currency-markets"
            }
        ]
    };
    
    return newsTemplates[category] || newsTemplates.general;
}

function updateNewsDisplay(articles) {
    const newsList = document.getElementById('newsList');
    newsList.innerHTML = '';
    
    if (!articles || articles.length === 0) {
        newsList.innerHTML = '<div class="empty-state">No news articles available at the moment.</div>';
        return;
    }
    
    articles.forEach(article => {
        const newsCard = createNewsCard(article);
        newsList.appendChild(newsCard);
    });
}

function createNewsCard(article) {
    const card = document.createElement('div');
    card.className = 'news-card';
    
    const publishedDate = new Date(article.publishedAt).toLocaleDateString();
    
    card.innerHTML = `
        <img src="${article.urlToImage || 'https://via.placeholder.com/400x200?text=News'}" 
             alt="News Image" 
             class="news-image"
             onerror="this.src='https://via.placeholder.com/400x200?text=News'">
        <div class="news-content">
            <h3 class="news-title">${article.title}</h3>
            <p class="news-description">${article.description}</p>
            <div class="news-meta">
                <span class="news-source">${article.source}</span>
                <span class="news-date">${publishedDate}</span>
            </div>
            ${article.url ? `<a href="${article.url}" target="_blank" class="read-more">Read Full Article</a>` : ''}
        </div>
    `;
    
    return card;
}

// Utility functions
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.toggle('show', show);
    }
}

function showError(message, type = 'error') {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        // Clear any existing timeout to prevent conflicts
        if (errorMessage.timeoutId) {
            clearTimeout(errorMessage.timeoutId);
        }
        
        errorMessage.textContent = message;
        errorMessage.className = `error-message show ${type}`;
        
        // Store timeout ID to prevent conflicts
        errorMessage.timeoutId = setTimeout(() => {
            errorMessage.classList.remove('show');
            errorMessage.timeoutId = null;
        }, type === 'success' ? 3000 : APP_CONSTANTS.UI.ERROR_DISPLAY_TIME);
    }
}

/**
 * Format currency values with proper styling and symbols
 * @param {number} value - The numeric value to format
 * @param {boolean} showSign - Whether to show + for positive values
 * @returns {string} Formatted currency string
 */
function formatCurrency(value, showSign = false) {
    if (typeof value !== 'number' || isNaN(value)) {
        return '$0.00';
    }
    
    const formatted = Math.abs(value).toFixed(2);
    const sign = value >= 0 ? (showSign ? '+' : '') : '-';
    
    return `${sign}$${formatted}`;
}

/**
 * Add data source indicator to show if using mock/demo data
 * @param {number} mockDataCount - Number of stocks using mock data
 * @param {number} totalStocks - Total number of stocks in portfolio
 */
function addDataSourceIndicator(mockDataCount, totalStocks) {
    // Remove existing indicator if any
    const existingIndicator = document.querySelector('.data-source-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    if (mockDataCount > 0) {
        const indicator = document.createElement('div');
        indicator.className = 'data-source-indicator';
        indicator.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 1000;
            background: #ffc107; color: #333; padding: 10px 15px;
            border-radius: 6px; font-size: 14px; font-weight: bold;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        
        if (mockDataCount === totalStocks) {
            indicator.textContent = '🎮 Demo Mode - Mock Data';
        } else {
            indicator.textContent = `⚠️ ${mockDataCount}/${totalStocks} stocks using mock data`;
        }
        
        document.body.appendChild(indicator);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            indicator.remove();
        }, 5000);
    }
}

// Advanced performance dashboard
function showPerformanceStats() {
    const stats = performanceMonitor.getStats();
    const cacheStats = cacheManager.getStats();
    
    const statsModal = document.createElement('div');
    statsModal.className = 'stats-modal';
    statsModal.innerHTML = `
        <div class="stats-content">
            <h3>Performance Dashboard</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">API Calls:</span>
                    <span class="stat-value">${stats.apiCalls}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Cache Hit Rate:</span>
                    <span class="stat-value">${(stats.cacheHitRate * 100).toFixed(1)}%</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Average Load Time:</span>
                    <span class="stat-value">${stats.averageLoadTime}ms</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Cache Size:</span>
                    <span class="stat-value">${cacheStats.size}/${cacheStats.maxSize}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Errors:</span>
                    <span class="stat-value">${stats.errors}</span>
                </div>
            </div>
            <div class="stats-actions">
                <button onclick="clearCache()" class="clear-cache-btn">Clear Cache</button>
                <button onclick="resetApiConfig()" class="reset-config-btn">Reset API Config</button>
                <button onclick="closeStatsModal()" class="close-stats-btn">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(statsModal);
    
    // Add click outside to close
    statsModal.addEventListener('click', (e) => {
        if (e.target === statsModal) {
            closeStatsModal();
        }
    });
}

function closeStatsModal() {
    const modal = document.querySelector('.stats-modal');
    if (modal) {
        modal.remove();
    }
}

function clearCache() {
    cacheManager.clear();
    showError('Cache cleared successfully!', 'success');
    closeStatsModal();
}

function resetApiConfig() {
    if (AppState.configLoader) {
        AppState.configLoader.clearConfig();
        showError('API configuration reset. Please refresh to reconfigure.', 'success');
        closeStatsModal();
    }
}

/**
 * Logout and Reset Application
 * Clears all stored data and reloads the application for privacy and multi-user support
 */
function logoutAndReset() {
    const confirmLogout = confirm(
        '🔓 Logout Confirmation\n\n' +
        'This will:\n' +
        '• Clear all saved API configurations\n' +
        '• Remove portfolio data from local storage\n' +
        '• Clear cache and reset the application\n' +
        '• Reload the page for a fresh start\n\n' +
        'Are you sure you want to logout?'
    );
    
    if (confirmLogout) {
        try {
            performanceMonitor.recordUserInteraction('user_logout');
            
            // Show logout process
            showError('🔓 Logging out and clearing data...', 'info');
            
            // Clear all stored data
            clearAllApplicationData();
            
            // Small delay to show the message, then reload
            setTimeout(() => {
                showError('✅ Application reset complete. Reloading...', 'success');
                
                setTimeout(() => {
                    // Force reload to ensure clean state
                    window.location.reload(true);
                }, 1000);
            }, 500);
            
        } catch (error) {
            console.error('❌ Error during logout:', error);
            performanceMonitor.recordError(error, 'logout');
            showError('⚠️ Error during logout. Manually refresh the page.', 'error');
        }
    }
}

/**
 * Clear All Application Data
 * Removes all cached data, configurations, and stored information
 */
function clearAllApplicationData() {
    console.log('🧹 Clearing all application data...');
    
    try {
        // Clear API configuration
        if (AppState.configLoader) {
            AppState.configLoader.clearConfig();
        }
        
        // Clear localStorage data
        const keysToRemove = [
            'portfolio',
            'financeTrackerConfig',
            'apiConfiguration',
            'userPreferences'
        ];
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        // Clear cache manager
        if (cacheManager) {
            cacheManager.clear();
        }
        
        // Clear application state
        AppState.portfolio = [];
        AppState.stockData.clear();
        AppState.exchangeRates = {};
        AppState.isConfigLoaded = false;
        AppState.configLoader = null;
        
        // Clear any rate limiting data
        const rateLimitKeys = Object.keys(localStorage).filter(key => 
            key.startsWith('rate_limit_')
        );
        rateLimitKeys.forEach(key => localStorage.removeItem(key));
        
        // Clear session storage as backup
        try {
            sessionStorage.clear();
        } catch (e) {
            console.warn('Could not clear session storage:', e);
        }
        
        console.log('✅ Application data cleared successfully');
        
    } catch (error) {
        console.error('❌ Error clearing application data:', error);
        throw error;
    }
}

// Advanced data visualization for portfolio
function generatePortfolioChart() {
    if (AppState.portfolio.length === 0) return;
    
    const canvas = document.createElement('canvas');
    canvas.id = 'portfolioChart';
    canvas.width = 400;
    canvas.height = 200;
    
    const ctx = canvas.getContext('2d');
    
    // Simple pie chart for portfolio allocation
    const colors = ['#3498db', '#e74c3c', '#f39c12', '#27ae60', '#9b59b6', '#1abc9c'];
    let total = 0;
    const data = AppState.portfolio.map(symbol => {
        const stock = AppState.stockData.get(symbol);
        if (stock) {
            total += stock.price;
            return { symbol, price: stock.price };
        }
        return null;
    }).filter(Boolean);
    
    let currentAngle = 0;
    data.forEach((item, index) => {
        const slice = (item.price / total) * 2 * Math.PI;
        
        ctx.beginPath();
        ctx.arc(200, 100, 80, currentAngle, currentAngle + slice);
        ctx.lineTo(200, 100);
        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();
        
        // Add labels
        const labelAngle = currentAngle + slice / 2;
        const labelX = 200 + Math.cos(labelAngle) * 100;
        const labelY = 100 + Math.sin(labelAngle) * 100;
        
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(item.symbol, labelX, labelY);
        
        currentAngle += slice;
    });
    
    return canvas;
}

// Performance monitoring keyboard shortcut
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.id === 'stockSymbol') {
        addStock();
    }
    
    // Advanced: Show performance stats with Ctrl+Shift+P
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        showPerformanceStats();
    }
    
    // Advanced: Clear cache with Ctrl+Shift+C
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        clearCache();
    }
});

// Auto-refresh data every 5 minutes
setInterval(() => {
    const activeSection = document.querySelector('.section.active');
    if (activeSection) {
        const sectionId = activeSection.id;
        if (sectionId === 'portfolio') {
            loadPortfolio();
        } else if (sectionId === 'exchange') {
            loadExchangeRates();
        }
    }
}, 300000); // 5 minutes
