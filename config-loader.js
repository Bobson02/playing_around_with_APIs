// Environment Configuration Loader
// This file loads API keys from environment variables or .env file

class ConfigLoader {
    constructor() {
        this.config = {};
        this.configPromise = this.loadConfig();
    }

    // Wait for configuration to be fully loaded
    async waitForConfig() {
        await this.configPromise;
        return this.config;
    }

    // Load configuration from environment variables or .env file
    async loadConfig() {
        try {
            // Try to load from environment variables first (for production)
            if (typeof process !== 'undefined' && process.env) {
                this.config = {
                    ALPHA_VANTAGE_KEY: process.env.ALPHA_VANTAGE_KEY,
                    EXCHANGE_RATE_KEY: process.env.EXCHANGE_RATE_KEY,
                    NEWS_API_KEY: process.env.NEWS_API_KEY
                };
            } else {
                // For client-side applications, check localStorage first
                const savedKeys = localStorage.getItem('api_keys_configured');
                if (savedKeys) {
                    try {
                        const parsed = JSON.parse(savedKeys);
                        this.config = parsed;
                        console.log('✅ Configuration loaded from localStorage');
                        return;
                    } catch (error) {
                        console.warn('Failed to parse stored config:', error);
                        localStorage.removeItem('api_keys_configured');
                    }
                }
                
                // If no stored config, prompt user to configure and wait for completion
                await this.promptForConfig();
                return;
            }

            // Validate that all required keys are present
            this.validateConfig();
        } catch (error) {
            console.error('Error in loadConfig:', error);
            await this.promptForConfig();
        }
    }

    // Prompt user to configure API keys (for development)
    async promptForConfig() {
        // Check if modal already exists to prevent duplicates
        if (document.querySelector('.config-modal')) {
            console.log('Configuration modal already exists');
            return;
        }
        
        // Double-check localStorage before showing modal
        const savedKeys = localStorage.getItem('api_keys_configured');
        if (savedKeys) {
            try {
                const keys = JSON.parse(savedKeys);
                if (keys.ALPHA_VANTAGE_KEY && keys.NEWS_API_KEY) {
                    console.log('✅ Found valid saved configuration');
                    this.config = keys;
                    return;
                }
            } catch (error) {
                console.warn('Invalid saved config, clearing:', error);
                localStorage.removeItem('api_keys_configured');
            }
        }

        // Show configuration modal and wait for user input
        console.log('🔑 Showing API configuration modal');
        return new Promise((resolve) => {
            this.showConfigModal(resolve);
        });
    }

    // Show modal for API key configuration
    showConfigModal(resolvePromise) {
        const modal = document.createElement('div');
        modal.className = 'config-modal';
        modal.innerHTML = `
            <div class="config-content">
                <h3>🔐 API Configuration Required</h3>
                <p>Please enter your API keys to use the application:</p>
                <form id="configForm">
                    <div class="config-field">
                        <label>Alpha Vantage API Key:</label>
                        <input type="password" id="alphaKey" placeholder="Your Alpha Vantage API key" required>
                        <small>Get it from: <a href="https://www.alphavantage.co/support/#api-key" target="_blank">alphavantage.co</a></small>
                    </div>
                    <div class="config-field">
                        <label>News API Key:</label>
                        <input type="password" id="newsKey" placeholder="Your News API key" required>
                        <small>Get it from: <a href="https://newsapi.org/register" target="_blank">newsapi.org</a></small>
                    </div>
                    <div class="config-field">
                        <label>Exchange Rate API Key:</label>
                        <input type="password" id="exchangeKey" placeholder="Your Exchange Rate API key (optional)">
                        <small>Get it from: <a href="https://app.exchangerate-api.com/sign-up" target="_blank">exchangerate-api.com</a></small>
                    </div>
                    <div class="config-actions">
                        <button type="submit" class="save-config-btn">💾 Save Configuration</button>
                        <button type="button" onclick="useDemo()" class="demo-btn">🎮 Use Demo Mode</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Handle form submission
        document.getElementById('configForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveConfiguration(resolvePromise);
        });

        // Add demo mode function to window
        window.useDemo = () => {
            try {
                this.config = {
                    ALPHA_VANTAGE_KEY: 'DEMO_MODE',
                    EXCHANGE_RATE_KEY: 'DEMO_MODE', 
                    NEWS_API_KEY: 'DEMO_MODE'
                };
                
                localStorage.setItem('api_keys_configured', JSON.stringify(this.config));
                
                // Verify save
                const saved = localStorage.getItem('api_keys_configured');
                if (saved) {
                    console.log('✅ Demo mode configuration saved');
                    modal.remove();
                    
                    // Resolve the promise to continue initialization
                    if (resolvePromise) {
                        resolvePromise();
                    }
                    
                    // Show demo mode message
                    const demoMsg = document.createElement('div');
                    demoMsg.style.cssText = `
                        position: fixed; top: 20px; right: 20px; z-index: 9999;
                        background: #ffc107; color: #333; padding: 15px 20px;
                        border-radius: 8px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    `;
                    demoMsg.textContent = '🎮 Demo mode activated! Loading application...';
                    document.body.appendChild(demoMsg);
                    
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    throw new Error('Demo mode save failed');
                }
            } catch (error) {
                console.error('❌ Failed to set demo mode:', error);
                alert('❌ Failed to activate demo mode. Please try again.');
            }
        };
    }

    // Save user configuration
    saveConfiguration(resolvePromise) {
        const alphaKey = document.getElementById('alphaKey').value.trim();
        const newsKey = document.getElementById('newsKey').value.trim();
        const exchangeKey = document.getElementById('exchangeKey').value.trim() || 'not_required';

        if (!alphaKey || !newsKey) {
            alert('❌ Please enter at least Alpha Vantage and News API keys');
            return false;
        }

        try {
            this.config = {
                ALPHA_VANTAGE_KEY: alphaKey,
                EXCHANGE_RATE_KEY: exchangeKey,
                NEWS_API_KEY: newsKey
            };

            // Save to localStorage with error handling
            localStorage.setItem('api_keys_configured', JSON.stringify(this.config));
            
            // Verify the save was successful
            const savedData = localStorage.getItem('api_keys_configured');
            if (savedData) {
                console.log('✅ Configuration saved successfully to localStorage');
                
                // Remove modal
                const modal = document.querySelector('.config-modal');
                if (modal) {
                    modal.remove();
                }
                
                // Resolve the promise to continue initialization
                if (resolvePromise) {
                    resolvePromise();
                }
                
                // Show success message before reload
                const successMsg = document.createElement('div');
                successMsg.style.cssText = `
                    position: fixed; top: 20px; right: 20px; z-index: 9999;
                    background: #28a745; color: white; padding: 15px 20px;
                    border-radius: 8px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                `;
                successMsg.textContent = '✅ Configuration saved! Reloading application...';
                document.body.appendChild(successMsg);
                
                // Reload page after short delay
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
                
                return true;
            } else {
                throw new Error('localStorage save verification failed');
            }
        } catch (error) {
            console.error('❌ Failed to save configuration:', error);
            alert('❌ Failed to save configuration. Please try again or check browser settings.');
            return false;
        }
    }

    // Validate that all required configuration is present
    validateConfig() {
        const required = ['ALPHA_VANTAGE_KEY', 'NEWS_API_KEY'];
        const missing = required.filter(key => !this.config[key] || this.config[key] === '');
        
        if (missing.length > 0) {
            console.warn('Missing required API keys:', missing);
            return false;
        }
        
        return true;
    }

    // Get API configuration
    getConfig() {
        return {
            // Alpha Vantage API for stock data
            ALPHA_VANTAGE_KEY: this.config.ALPHA_VANTAGE_KEY,
            ALPHA_VANTAGE_URL: 'https://www.alphavantage.co/query',
            
            // ExchangeRate-API for currency data
            EXCHANGE_RATE_URL: 'https://api.exchangerate-api.com/v4/latest',
            EXCHANGE_RATE_KEY: this.config.EXCHANGE_RATE_KEY,
            
            // NewsAPI for financial news
            NEWS_API_KEY: this.config.NEWS_API_KEY,
            NEWS_API_URL: 'https://newsapi.org/v2/everything'
        };
    }

    // Check if running in demo mode
    isDemoMode() {
        return this.config.ALPHA_VANTAGE_KEY === 'DEMO_MODE';
    }

    // Clear stored configuration (for development)
    clearConfig() {
        try {
            localStorage.removeItem('api_keys_configured');
            localStorage.removeItem('api_config');
            this.config = {};
            console.log('✅ Configuration cleared from localStorage');
            
            // Verify clearing
            const check = localStorage.getItem('api_keys_configured');
            if (check === null) {
                console.log('✅ localStorage clear verified');
            } else {
                console.warn('⚠ localStorage may not have been properly cleared');
            }
        } catch (error) {
            console.error('❌ Failed to clear configuration:', error);
        }
    }

    // Debug method to check localStorage status
    debugStorage() {
        console.log('🔍 LocalStorage Debug Info:');
        console.log('- api_keys_configured:', localStorage.getItem('api_keys_configured'));
        console.log('- api_config:', localStorage.getItem('api_config'));
        console.log('- localStorage available:', typeof Storage !== 'undefined');
        console.log('- Current config:', this.config);
    }

    // Force demo mode for testing
    forceDemoMode() {
        console.log('🎮 Forcing demo mode for testing...');
        this.config = {
            ALPHA_VANTAGE_KEY: 'DEMO_MODE',
            EXCHANGE_RATE_KEY: 'DEMO_MODE', 
            NEWS_API_KEY: 'DEMO_MODE'
        };
        localStorage.setItem('api_keys_configured', JSON.stringify(this.config));
        console.log('✅ Demo mode forced and saved');
        return this.config;
    }
}

// Export for use in main application
window.ConfigLoader = ConfigLoader;