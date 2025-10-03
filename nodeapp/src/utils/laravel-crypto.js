const crypto = require('crypto');
const logger = require('./logger');

/**
 * Laravel-compatible encryption/decryption utility
 * Handles decryption of Laravel encrypted values using AES-256-CBC cipher
 */
class LaravelCrypto {
    constructor() {
        this.appKey = null;
        this.cipher = 'AES-256-CBC';
    }

    /**
     * Initialize with Laravel APP_KEY
     * @param {string} appKey - Laravel APP_KEY from .env (base64:xxx format)
     */
    initialize(appKey) {
        if (!appKey) {
            throw new Error('APP_KEY is required for Laravel decryption');
        }

        // Remove 'base64:' prefix if present
        if (appKey.startsWith('base64:')) {
            this.appKey = Buffer.from(appKey.substring(7), 'base64');
        } else {
            this.appKey = Buffer.from(appKey, 'utf8');
        }
    }

    /**
     * Check if crypto is initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this.appKey !== null;
    }

    /**
     * Decrypt Laravel encrypted value
     * Laravel format: {"iv":"xxx","value":"xxx","mac":"xxx","tag":"xxx"}
     * @param {string} encryptedValue - JSON string with Laravel encryption format
     * @returns {string} - Decrypted value
     */
    decrypt(encryptedValue) {
        if (!this.isInitialized()) {
            logger.error('LaravelCrypto not initialized - APP_KEY missing', {
                hint: 'Add APP_KEY to nodeapp/.env from Source/.env'
            });
            throw new Error('LaravelCrypto not initialized. Call initialize() with APP_KEY first.');
        }

        try {
            // Parse the Laravel encrypted format
            const payload = JSON.parse(encryptedValue);

            if (!payload.iv || !payload.value || !payload.mac) {
                logger.warn('Invalid Laravel encrypted payload format', {
                    hasIv: !!payload.iv,
                    hasValue: !!payload.value,
                    hasMac: !!payload.mac
                });
                throw new Error('Invalid Laravel encrypted payload format');
            }

            // Verify MAC (Message Authentication Code)
            const mac = this.hash(payload.iv, payload.value);
            if (mac !== payload.mac) {
                logger.error('MAC verification failed - APP_KEY may be incorrect', {
                    hint: 'Ensure APP_KEY in nodeapp/.env matches Source/.env exactly'
                });
                throw new Error('MAC verification failed - data may be corrupted');
            }

            // Decode from base64
            const iv = Buffer.from(payload.iv, 'base64');
            const value = Buffer.from(payload.value, 'base64');

            // Create decipher
            const decipher = crypto.createDecipheriv('aes-256-cbc', this.appKey, iv);
            
            // Decrypt
            let decrypted = decipher.update(value);
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            const decryptedValue = decrypted.toString('utf8');
            logger.debug('Successfully decrypted Laravel value');
            return decryptedValue;
        } catch (error) {
            logger.error('Failed to decrypt Laravel value', {
                error: error.message,
                valuePreview: encryptedValue.substring(0, 50) + '...',
                hint: 'Check if APP_KEY in nodeapp/.env matches Source/.env'
            });
            // Return original value if decryption fails
            return encryptedValue;
        }
    }

    /**
     * Calculate HMAC hash for MAC verification
     * @param {string} iv - Initialization vector
     * @param {string} value - Encrypted value
     * @returns {string} - HMAC hash
     */
    hash(iv, value) {
        const payload = `${iv}${value}`;
        return crypto
            .createHmac('sha256', this.appKey)
            .update(payload)
            .digest('hex');
    }

    /**
     * Check if a value is Laravel encrypted format
     * @param {string} value 
     * @returns {boolean}
     */
    isEncrypted(value) {
        if (typeof value !== 'string') {
            return false;
        }

        try {
            const parsed = JSON.parse(value);
            return !!(parsed.iv && parsed.value && parsed.mac);
        } catch {
            return false;
        }
    }

    /**
     * Decrypt value if it's encrypted, otherwise return as-is
     * @param {string} value 
     * @returns {string}
     */
    decryptIfNeeded(value) {
        if (!value) {
            return value;
        }

        if (this.isEncrypted(value)) {
            return this.decrypt(value);
        }

        return value;
    }
}

// Export singleton instance
module.exports = new LaravelCrypto();
