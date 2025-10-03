/**
 * Simple PHP unserialize implementation for Node.js
 * Handles basic PHP serialized strings (s:length:"value";)
 * 
 * This is a minimal implementation focused on Laravel's use case.
 * It handles: strings (s:), integers (i:), booleans (b:), null (N;)
 */

/**
 * Unserialize PHP serialized string
 * @param {string} data - PHP serialized data
 * @returns {any} - Unserialized value
 */
function phpUnserialize(data) {
    if (!data || typeof data !== 'string') {
        return data;
    }

    // Trim whitespace
    data = data.trim();

    // Check if it looks like PHP serialized format
    if (!data.match(/^[sbiaNOdr]:/)) {
        // Not serialized, return as-is
        return data;
    }

    let index = 0;

    function parseValue() {
        const type = data[index];
        index += 2; // Skip type and colon

        switch (type) {
            case 's': // String
                return parseString();
            case 'i': // Integer
                return parseInteger();
            case 'b': // Boolean
                return parseBoolean();
            case 'N': // Null
                index -= 1; // N doesn't have a colon
                return null;
            case 'a': // Array (not fully implemented)
                throw new Error('PHP arrays not supported in this minimal implementation');
            case 'O': // Object (not fully implemented)
                throw new Error('PHP objects not supported in this minimal implementation');
            default:
                throw new Error(`Unknown PHP serialize type: ${type}`);
        }
    }

    function parseString() {
        // Format: s:length:"value";
        // We're at the length part
        const colonPos = data.indexOf(':', index);
        if (colonPos === -1) {
            throw new Error('Invalid PHP serialized string format');
        }

        const length = parseInt(data.substring(index, colonPos), 10);
        index = colonPos + 1;

        // Skip opening quote
        if (data[index] !== '"') {
            throw new Error('Expected opening quote in PHP serialized string');
        }
        index++;

        // Extract string value
        const value = data.substring(index, index + length);
        index += length;

        // Skip closing quote
        if (data[index] !== '"') {
            throw new Error('Expected closing quote in PHP serialized string');
        }
        index++;

        // Skip semicolon
        if (data[index] === ';') {
            index++;
        }

        return value;
    }

    function parseInteger() {
        // Format: i:value;
        const semicolonPos = data.indexOf(';', index);
        if (semicolonPos === -1) {
            throw new Error('Invalid PHP serialized integer format');
        }

        const value = parseInt(data.substring(index, semicolonPos), 10);
        index = semicolonPos + 1;
        return value;
    }

    function parseBoolean() {
        // Format: b:0; or b:1;
        const value = data[index] === '1';
        index += 2; // Skip value and semicolon
        return value;
    }

    try {
        return parseValue();
    } catch (error) {
        // If unserialize fails, return original value
        console.warn('PHP unserialize failed, returning original value:', error.message);
        return data;
    }
}

/**
 * Check if a value is PHP serialized
 * @param {string} data 
 * @returns {boolean}
 */
function isPhpSerialized(data) {
    if (!data || typeof data !== 'string') {
        return false;
    }

    // Check for PHP serialized format markers
    return /^[sbiaNOdr]:/.test(data.trim());
}

module.exports = {
    phpUnserialize,
    isPhpSerialized
};
