#!/usr/bin/env node

/**
 * Test script to verify Laravel decryption is working
 * Usage: node test-decrypt.js
 */

require('dotenv').config();
const laravelCrypto = require('./src/utils/laravel-crypto');
const db = require('./src/config/database');

async function testDecryption() {
    console.log('========================================');
    console.log('Laravel Decryption Test');
    console.log('========================================\n');

    // Check if APP_KEY is set
    const appKey = process.env.APP_KEY;
    if (!appKey) {
        console.error('❌ APP_KEY is not set in .env file');
        console.error('   Add APP_KEY=base64:xxx to nodeapp/.env');
        process.exit(1);
    }

    console.log('✅ APP_KEY found:', appKey.substring(0, 20) + '...\n');

    // Initialize crypto
    try {
        laravelCrypto.initialize(appKey);
        console.log('✅ Laravel crypto initialized successfully\n');
    } catch (error) {
        console.error('❌ Failed to initialize Laravel crypto:', error.message);
        process.exit(1);
    }

    // Test with actual database values
    try {
        console.log('Fetching vendor settings from database...');
        const [settings] = await db.execute(
            `SELECT name, value 
            FROM vendor_settings 
            WHERE vendors__id = 1 
            AND name IN ('whatsapp_access_token', 'current_phone_number_id')
            LIMIT 2`
        );

        if (settings.length === 0) {
            console.error('❌ No settings found for vendor 1');
            process.exit(1);
        }

        console.log(`\nFound ${settings.length} settings:\n`);

        for (const row of settings) {
            const isEncrypted = laravelCrypto.isEncrypted(row.value);
            console.log(`Setting: ${row.name}`);
            console.log(`  Is Encrypted: ${isEncrypted}`);
            console.log(`  Raw Value (first 80 chars): ${row.value.substring(0, 80)}...`);

            if (isEncrypted) {
                try {
                    const decrypted = laravelCrypto.decrypt(row.value);
                    console.log(`  ✅ Decrypted Value (first 30 chars): ${decrypted.substring(0, 30)}...`);
                    
                    // For access token, check if it looks valid
                    if (row.name === 'whatsapp_access_token') {
                        if (decrypted.startsWith('EAA') || decrypted.startsWith('EAAB')) {
                            console.log(`  ✅ Access token format looks valid (starts with EAA)`);
                        } else {
                            console.log(`  ⚠️  Warning: Access token doesn't start with EAA (got: ${decrypted.substring(0, 10)}...)`);
                        }
                    }
                } catch (error) {
                    console.log(`  ❌ Decryption FAILED: ${error.message}`);
                }
            } else {
                console.log(`  ℹ️  Value is not encrypted, using as-is`);
            }
            console.log('');
        }

        console.log('========================================');
        console.log('Test Complete');
        console.log('========================================');

    } catch (error) {
        console.error('❌ Database error:', error.message);
        process.exit(1);
    }

    process.exit(0);
}

testDecryption();
