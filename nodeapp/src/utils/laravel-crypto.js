const crypto = require('crypto');
const logger = require('./logger');

function getAppKeyBuffer() {
    const rawKey = process.env.APP_KEY;
    if (!rawKey) {
        throw new Error('APP_KEY environment variable is not set');
    }

    if (rawKey.startsWith('base64:')) {
        return Buffer.from(rawKey.slice(7), 'base64');
    }

    return Buffer.from(rawKey, 'utf8');
}

function isLaravelPayload(value) {
    if (typeof value !== 'string') {
        return false;
    }

    try {
        const decoded = Buffer.from(value, 'base64').toString('utf8');
        const payload = JSON.parse(decoded);
        return payload && payload.iv && payload.value && payload.mac;
    } catch (error) {
        return false;
    }
}

function decryptLaravelValue(value, context = {}) {
    if (!value) {
        return value;
    }

    if (!isLaravelPayload(value)) {
        return value;
    }

    try {
        const key = getAppKeyBuffer();
        if (key.length !== 32) {
            throw new Error('APP_KEY must be 32 bytes for AES-256-CBC');
        }

        const decoded = Buffer.from(value, 'base64').toString('utf8');
        const payload = JSON.parse(decoded);

        const iv = Buffer.from(payload.iv, 'base64');
        const cipherText = Buffer.from(payload.value, 'base64');
        const mac = payload.mac;

        if (iv.length !== 16) {
            throw new Error('Invalid IV length in payload');
        }

        const hmac = crypto
            .createHmac('sha256', key)
            .update(Buffer.concat([iv, Buffer.from(payload.value, 'utf8')]))
            .digest('hex');

        if (!crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(mac, 'hex'))) {
            throw new Error('Payload MAC is invalid');
        }

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(cipherText, undefined, 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        logger.warn('Failed to decrypt Laravel value, returning raw string', {
            ...context,
            error: error.message,
        });
        return value;
    }
}

module.exports = {
    decryptLaravelValue,
    isLaravelPayload,
};
