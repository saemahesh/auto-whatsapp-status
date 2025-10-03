const axios = require('axios');
const db = require('./database');
const logger = require('../utils/logger');

class WhatsAppAPI {
    constructor() {
        // Use v23.0 to match PHP implementation
        this.baseURL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v23.0';
        this.vendorSettingsCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache for vendor settings
    }

    /**
     * Get vendor settings from database (matches PHP getVendorSettings)
     * @param {number} vendorId 
     * @returns {Promise<object>}
     */
    async getVendorSettings(vendorId) {
        // Check cache first
        const cacheKey = `vendor_${vendorId}`;
        const cached = this.vendorSettingsCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            return cached.data;
        }

        try {
            // Fetch vendor configuration from vendor_settings table (like PHP)
            const [settings] = await db.execute(
                `SELECT name, value 
                FROM vendor_settings 
                WHERE vendors__id = ? AND status = 1 
                AND name IN ('whatsapp_access_token', 'current_phone_number_id', 'whatsapp_business_account_id', 'current_phone_number_number')`,
                [vendorId]
            );

            if (settings.length === 0) {
                throw new Error(`Vendor ${vendorId} settings not found`);
            }

            // Convert array of settings to object
            const settingsObj = {};
            settings.forEach(row => {
                settingsObj[row.name] = row.value;
            });

            const vendorSettings = {
                accessToken: settingsObj.whatsapp_access_token,
                phoneNumberId: settingsObj.current_phone_number_id,
                businessAccountId: settingsObj.whatsapp_business_account_id,
                phoneNumber: settingsObj.current_phone_number_number
            };

            // Validate required settings
            if (!vendorSettings.accessToken || !vendorSettings.phoneNumberId) {
                throw new Error(`Vendor ${vendorId} missing required WhatsApp configuration`);
            }

            // Cache the settings
            this.vendorSettingsCache.set(cacheKey, {
                data: vendorSettings,
                timestamp: Date.now()
            });

            return vendorSettings;
        } catch (error) {
            logger.error('Error fetching vendor settings', { 
                error: error.message, 
                vendorId 
            });
            throw error;
        }
    }

    /**
     * Clean media links from components (matches PHP cleanMediaLinks)
     * Removes 'link' property if 'id' exists for image/video/document
     * @param {array} components 
     * @returns {array}
     */
    cleanMediaLinks(components) {
        const mediaTypes = ['image', 'video', 'document'];
        const isCarouselTemplate = components[1]?.type === 'carousel';

        if (isCarouselTemplate) {
            return this.cleanCarouselMediaLink(components);
        }

        // Deep clone to avoid mutation
        const cleanedComponents = JSON.parse(JSON.stringify(components));

        cleanedComponents.forEach(item => {
            if (!item.parameters || !Array.isArray(item.parameters)) {
                return;
            }

            item.parameters.forEach(param => {
                mediaTypes.forEach(type => {
                    if (param[type] && typeof param[type] === 'object') {
                        // If 'id' exists and is not empty, remove 'link'
                        if (param[type].id && param[type].id !== '') {
                            delete param[type].link;
                        }
                    }
                });
            });
        });

        return cleanedComponents;
    }

    /**
     * Clean carousel media links recursively (matches PHP cleanCarouselMediaLink)
     * @param {any} data 
     * @returns {any}
     */
    cleanCarouselMediaLink(data) {
        if (Array.isArray(data)) {
            return data.map(item => this.cleanCarouselMediaLink(item))
                      .filter((value, key) => key !== 'link');
        }

        if (typeof data === 'object' && data !== null) {
            const result = {};
            for (const [key, value] of Object.entries(data)) {
                if (key !== 'link') {
                    result[key] = this.cleanCarouselMediaLink(value);
                }
            }
            return result;
        }

        return data;
    }

    /**
     * Send template message (matches PHP sendTemplateMessage)
     * @param {number} vendorId 
     * @param {string} to 
     * @param {string} templateName 
     * @param {string} language 
     * @param {array} components 
     * @returns {Promise<object>}
     */
    async sendTemplateMessage(vendorId, to, templateName, language, components = []) {
        try {
            const settings = await this.getVendorSettings(vendorId);

            // Clean media links like PHP does
            const cleanedComponents = this.cleanMediaLinks(components);

            const response = await axios.post(
                `${this.baseURL}/${settings.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',  // Added to match PHP
                    to: to,
                    type: 'template',
                    template: {
                        name: templateName,
                        language: { code: language },
                        components: cleanedComponents
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${settings.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: parseInt(process.env.HTTP_TIMEOUT) || 10000
                }
            );

            logger.info('Template message sent', { 
                to, 
                templateName, 
                wamid: response.data.messages[0].id,
                vendorId 
            });

            return {
                success: true,
                wamid: response.data.messages[0].id,
                data: response.data
            };
        } catch (error) {
            logger.error('Failed to send template message', {
                error: error.response?.data || error.message,
                to,
                templateName,
                vendorId
            });

            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    /**
     * Send text message (matches PHP sendMessage)
     * @param {number} vendorId 
     * @param {string} to 
     * @param {string} message 
     * @param {object} options - Optional: { repliedToMessageWamid: string }
     * @returns {Promise<object>}
     */
    async sendTextMessage(vendorId, to, message, options = {}) {
        try {
            const settings = await this.getVendorSettings(vendorId);

            const messageData = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',  // Added to match PHP
                to: to,
                type: 'text',
                text: { 
                    preview_url: true,  // Matches PHP: preview_url: true
                    body: message 
                }
            };

            // Add context for reply (matches PHP context support)
            if (options.repliedToMessageWamid) {
                messageData.context = {
                    message_id: options.repliedToMessageWamid
                };
            }

            const response = await axios.post(
                `${this.baseURL}/${settings.phoneNumberId}/messages`,
                messageData,
                {
                    headers: {
                        'Authorization': `Bearer ${settings.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: parseInt(process.env.HTTP_TIMEOUT) || 10000
                }
            );

            logger.info('Text message sent', { 
                to, 
                wamid: response.data.messages[0].id,
                vendorId,
                hasReply: !!options.repliedToMessageWamid
            });

            return {
                success: true,
                wamid: response.data.messages[0].id,
                data: response.data
            };
        } catch (error) {
            logger.error('Failed to send text message', {
                error: error.response?.data || error.message,
                to,
                vendorId
            });

            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    /**
     * Send interactive message (matches PHP sendInteractiveMessage)
     * Supports button messages, list messages, and CTA URL messages
     * @param {number} vendorId 
     * @param {string} to 
     * @param {object} messageData - Interactive message configuration
     * @returns {Promise<object>}
     */
    async sendInteractiveMessage(vendorId, to, messageData) {
        try {
            const settings = await this.getVendorSettings(vendorId);

            // Merge with defaults (matches PHP defaults)
            const data = {
                interactive_type: 'button',
                media_link: '',
                header_type: '', // "text", "image", or "video"
                header_text: '',
                body_text: '',
                footer_text: '',
                buttons: [],
                cta_url: null,
                action: null,
                list_data: null,
                ...messageData
            };

            const interactiveData = {
                type: data.interactive_type
            };

            // Header handling (matches PHP logic)
            if (data.header_type && data.header_type !== 'text') {
                interactiveData.header = {
                    type: data.header_type,
                    [data.header_type]: {
                        link: data.media_link
                    }
                };
            } else if (data.header_type === 'text') {
                interactiveData.header = {
                    type: 'text',
                    text: data.header_text
                };
            }

            // Body text
            if (data.body_text) {
                interactiveData.body = {
                    text: data.body_text
                };
            }

            // Footer text
            if (data.footer_text) {
                interactiveData.footer = {
                    text: data.footer_text
                };
            }

            // Action handling based on interactive_type
            if (data.interactive_type === 'list') {
                // List message
                const sections = [];
                const listSections = data.list_data?.sections || [];
                
                listSections.forEach(section => {
                    const sectionData = {
                        title: section.title,
                        rows: []
                    };
                    
                    (section.rows || []).forEach(row => {
                        sectionData.rows.push({
                            id: row.row_id,
                            title: row.title,
                            description: row.description
                        });
                    });
                    
                    sections.push(sectionData);
                });

                interactiveData.action = {
                    button: data.list_data?.button_text || 'Select',
                    sections: sections
                };
            } else if (data.interactive_type === 'cta_url') {
                // CTA URL message
                interactiveData.action = {
                    name: 'cta_url',
                    parameters: data.cta_url
                };
            } else if (data.interactive_type === 'button') {
                // Button message
                const buttons = [];
                
                if (data.buttons && data.buttons.length > 0) {
                    data.buttons.forEach((button, index) => {
                        buttons.push({
                            type: 'reply',
                            reply: {
                                id: `button-id${index + 1}`,
                                title: button
                            }
                        });
                    });
                    
                    interactiveData.action = {
                        buttons: buttons
                    };
                }
            }

            const response = await axios.post(
                `${this.baseURL}/${settings.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'interactive',
                    interactive: interactiveData
                },
                {
                    headers: {
                        'Authorization': `Bearer ${settings.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: parseInt(process.env.HTTP_TIMEOUT) || 10000
                }
            );

            logger.info('Interactive message sent', { 
                to, 
                type: data.interactive_type,
                wamid: response.data.messages[0].id,
                vendorId 
            });

            return {
                success: true,
                wamid: response.data.messages[0].id,
                data: response.data
            };
        } catch (error) {
            logger.error('Failed to send interactive message', {
                error: error.response?.data || error.message,
                to,
                vendorId
            });

            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    /**
     * Send media message (matches PHP sendMediaMessage)
     * Supports image, video, document, audio, and sticker
     * @param {number} vendorId 
     * @param {string} to 
     * @param {string} type - Media type: image, video, document, audio, sticker
     * @param {string|object} mediaLink - URL string or object with {id} or {link}
     * @param {string} caption - Caption for media (not for audio/sticker)
     * @param {string} filename - Filename for documents
     * @returns {Promise<object>}
     */
    async sendMediaMessage(vendorId, to, type, mediaLink, caption = '', filename = '') {
        try {
            const settings = await this.getVendorSettings(vendorId);

            const typeDetails = {};

            // Handle mediaLink format (matches PHP logic)
            if (typeof mediaLink === 'object') {
                if (mediaLink.id) {
                    typeDetails.id = mediaLink.id;
                } else if (mediaLink.link) {
                    typeDetails.link = mediaLink.link;
                }
            } else {
                typeDetails.link = mediaLink;
            }

            // Caption only for non-audio/sticker types (matches PHP)
            if (!['audio', 'sticker'].includes(type)) {
                typeDetails.caption = caption;
            }

            // Filename only for documents (matches PHP)
            if (type === 'document') {
                typeDetails.filename = filename;
            }

            const response = await axios.post(
                `${this.baseURL}/${settings.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: type,
                    [type]: typeDetails
                },
                {
                    headers: {
                        'Authorization': `Bearer ${settings.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: parseInt(process.env.HTTP_TIMEOUT) || 10000
                }
            );

            logger.info('Media message sent', { 
                to, 
                type,
                wamid: response.data.messages[0].id,
                vendorId 
            });

            return {
                success: true,
                wamid: response.data.messages[0].id,
                data: response.data
            };
        } catch (error) {
            logger.error('Failed to send media message', {
                error: error.response?.data || error.message,
                to,
                type,
                vendorId
            });

            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    /**
     * Mark message as read (matches PHP markAsRead)
     * @param {number} vendorId 
     * @param {string} to - Phone number
     * @param {string} messageId - Message WAMID to mark as read
     * @returns {Promise<object>}
     */
    async markAsRead(vendorId, to, messageId) {
        try {
            const settings = await this.getVendorSettings(vendorId);

            const response = await axios.post(
                `${this.baseURL}/${settings.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    status: 'read',
                    message_id: messageId
                },
                {
                    headers: {
                        'Authorization': `Bearer ${settings.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: parseInt(process.env.HTTP_TIMEOUT) || 10000
                }
            );

            logger.info('Message marked as read', { 
                to, 
                messageId,
                vendorId 
            });

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            logger.error('Failed to mark message as read', {
                error: error.response?.data || error.message,
                to,
                messageId,
                vendorId
            });

            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    /**
     * Clear vendor settings cache
     * @param {number} vendorId - Optional specific vendor ID to clear
     */
    clearCache(vendorId = null) {
        if (vendorId) {
            this.vendorSettingsCache.delete(`vendor_${vendorId}`);
        } else {
            this.vendorSettingsCache.clear();
        }
    }
}

// Export singleton instance
module.exports = new WhatsAppAPI();
