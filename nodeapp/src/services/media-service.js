const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');
const whatsappApi = require('../config/whatsapp');

/**
 * MediaService - Handles media file downloads and storage
 * Matches PHP MediaEngine functionality
 */
class MediaService {
    constructor() {
        // MIME type to extension mapping (matches PHP at line 216)
        this.mimeTypesToExtension = {
            // audio
            'audio/aac': 'aac',
            'audio/mp4': 'm4a',
            'audio/mpeg': 'mp3',
            'audio/amr': 'amr',
            'audio/ogg': 'ogg',
            // videos
            'video/mp4': 'mp4',
            'video/3gp': '3gp',
            'video/mpeg': 'mpeg',
            // images
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            // documents
            'text/plain': 'txt',
            'application/pdf': 'pdf',
            'application/vnd.ms-powerpoint': 'ppt',
            'application/msword': 'doc',
            'application/vnd.ms-excel': 'xls',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'application/zip': 'zip'
        };

        // Base storage path
        this.baseStoragePath = process.env.MEDIA_STORAGE_PATH || path.join(__dirname, '../../storage/media');
    }

    /**
     * Download and store media file from WhatsApp
     * Matches PHP downloadAndStoreMediaFile() at line 214
     * 
     * @param {string} mediaId - WhatsApp media ID
     * @param {string} vendorUid - Vendor UID
     * @param {number} vendorId - Vendor ID
     * @param {string} mediaType - Type: image, video, audio, document, sticker
     * @returns {Promise<object>} - { path, fileName, mime_type, file_size }
     */
    async downloadAndStoreMediaFile(mediaId, vendorUid, vendorId, mediaType = 'image') {
        try {
            // Download media from WhatsApp API
            logger.info(`Downloading media: ${mediaId} for vendor: ${vendorUid}`);
            const mediaData = await whatsappApi.downloadMedia(mediaId, vendorId);

            if (!mediaData || !mediaData.body) {
                throw new Error('Media download failed - no data received');
            }

            // Get file extension from MIME type
            const extension = this.mimeTypesToExtension[mediaData.mime_type] || 'bin';
            
            // Generate unique filename
            const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${extension}`;

            // Create vendor-specific directory path
            // Matches PHP: getPathByKey("whatsapp_$mediaType", ['{_uid}' => $vendorUid])
            const vendorDir = path.join(this.baseStoragePath, vendorUid, 'whatsapp', mediaType);
            
            // Ensure directory exists
            await fs.mkdir(vendorDir, { recursive: true });

            // Full file path
            const filePath = path.join(vendorDir, filename);

            // Write file to disk
            await fs.writeFile(filePath, Buffer.from(mediaData.body));

            // Relative path for database storage
            const relativePath = path.join(vendorUid, 'whatsapp', mediaType, filename);

            logger.info(`Media stored successfully: ${relativePath}`);

            return {
                path: relativePath,
                fileName: filename,
                mime_type: mediaData.mime_type,
                file_size: mediaData.file_size,
                sha256: mediaData.sha256,
                original_filename: filename
            };
        } catch (error) {
            logger.error('Error downloading and storing media:', {
                error: error.message,
                mediaId,
                vendorUid,
                mediaType
            });
            
            // Return null to match PHP behavior (catches exception and returns empty)
            return null;
        }
    }

    /**
     * Delete a media file
     * @param {string} filePath - Relative file path
     * @returns {Promise<boolean>}
     */
    async deleteFile(filePath) {
        try {
            const fullPath = path.join(this.baseStoragePath, filePath);
            await fs.unlink(fullPath);
            logger.info(`File deleted: ${filePath}`);
            return true;
        } catch (error) {
            logger.error('Error deleting file:', {
                error: error.message,
                filePath
            });
            return false;
        }
    }

    /**
     * Check if file exists
     * @param {string} filePath - Relative file path
     * @returns {Promise<boolean>}
     */
    async fileExists(filePath) {
        try {
            const fullPath = path.join(this.baseStoragePath, filePath);
            await fs.access(fullPath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get full URL for a media file
     * @param {string} relativePath - Relative file path
     * @returns {string}
     */
    getMediaUrl(relativePath) {
        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        return `${baseUrl}/media/${relativePath}`;
    }

    /**
     * Clean up old temporary files
     * Matches PHP deleteOldFiles() at line 347
     * @param {number} maxAge - Maximum age in seconds (default: 3600 = 1 hour)
     * @returns {Promise<number>} - Number of files deleted
     */
    async cleanupOldFiles(maxAge = 3600) {
        try {
            const tempDir = path.join(this.baseStoragePath, 'temp');
            const now = Date.now();
            let deletedCount = 0;

            // Check if temp directory exists
            try {
                await fs.access(tempDir);
            } catch {
                return 0; // Directory doesn't exist
            }

            const files = await fs.readdir(tempDir);

            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = await fs.stat(filePath);

                // Check if file is older than maxAge
                const fileAge = (now - stats.mtimeMs) / 1000;
                if (fileAge > maxAge) {
                    await fs.unlink(filePath);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                logger.info(`Cleaned up ${deletedCount} old temporary files`);
            }

            return deletedCount;
        } catch (error) {
            logger.error('Error cleaning up old files:', error);
            return 0;
        }
    }
}

module.exports = new MediaService();
