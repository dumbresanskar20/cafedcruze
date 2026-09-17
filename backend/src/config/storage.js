const path = require('path');
const fs = require('fs');

// Resolve the root uploads directory
// Priority:
// 1. Process environment UPLOAD_DIR (e.g. /home/mealbook/uploads)
// 2. cPanel parent uploads folder if it exists (/home/mealbook/uploads relative to /home/mealbook/api/src)
// 3. Local backend/uploads folder for development
let resolvedUploadsDir = path.resolve(__dirname, '../../../uploads');
if (process.env.UPLOAD_DIR) {
  resolvedUploadsDir = path.resolve(process.env.UPLOAD_DIR);
} else if (fs.existsSync(resolvedUploadsDir)) {
  // Use parent uploads directory
} else {
  resolvedUploadsDir = path.resolve(__dirname, '../../uploads');
}

const UPLOADS_DIR = resolvedUploadsDir;
const MENU_UPLOADS_DIR = path.join(UPLOADS_DIR, 'menu');

// Ensure necessary directories exist
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(MENU_UPLOADS_DIR)) {
    fs.mkdirSync(MENU_UPLOADS_DIR, { recursive: true });
  }
  console.log(`[Storage] Initialized local uploads directory at: ${MENU_UPLOADS_DIR}`);
} catch (err) {
  console.error(`[Storage Error] Failed to create uploads directory: ${err.message}`);
}

/**
 * Safely deletes a local file associated with a menu item
 * @param {string} imagePathOrUrl - e.g. '/uploads/menu/filename.jpg' or 'https://devapi.mealbook.in/uploads/menu/filename.jpg'
 */
const deleteLocalImage = async (imagePathOrUrl) => {
  if (!imagePathOrUrl || typeof imagePathOrUrl !== 'string') return;

  // Only delete files that are stored under our /uploads/menu/ directory
  if (!imagePathOrUrl.includes('/uploads/menu/')) return;

  try {
    // Extract filename from URL or relative path
    const parts = imagePathOrUrl.split('/uploads/menu/');
    if (parts.length > 1) {
      const fileName = parts[1].split('?')[0].split('#')[0]; // clean query params
      // Prevent directory traversal
      const safeFileName = path.basename(fileName);
      const fullFilePath = path.join(MENU_UPLOADS_DIR, safeFileName);

      if (fs.existsSync(fullFilePath)) {
        await fs.promises.unlink(fullFilePath);
        console.log(`[Storage] Deleted old local image: ${safeFileName}`);
      }
    }
  } catch (err) {
    console.warn(`[Storage Warning] Could not delete local image (${imagePathOrUrl}): ${err.message}`);
  }
};

/**
 * Formats a stored image path into a publicly accessible absolute URL if needed
 * @param {string} imageUrl - e.g. '/uploads/menu/filename.jpg' or 'https://...'
 * @param {object} [req] - Express request object
 * @returns {string} - Absolute URL
 */
const formatPublicImageUrl = (imageUrl, req) => {
  if (!imageUrl) {
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
  }

  // If it's already an absolute URL (e.g. Unsplash), return it directly
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // If it's a relative uploads path, prepend the backend host
  if (imageUrl.startsWith('/uploads/')) {
    let baseUrl = process.env.API_BASE_URL;
    if (!baseUrl && req) {
      baseUrl = `${req.protocol}://${req.get('host')}`;
    }
    if (!baseUrl) {
      baseUrl = 'https://cafe-d-cruze-api.mealbook.in';
    }
    return `${baseUrl.replace(/\/+$/, '')}${imageUrl}`;
  }

  return imageUrl;
};

module.exports = {
  UPLOADS_DIR,
  MENU_UPLOADS_DIR,
  deleteLocalImage,
  formatPublicImageUrl,
};
