const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { MENU_UPLOADS_DIR } = require('../config/storage');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('[Upload Warning] sharp module not available, fallback to uncompressed upload:', e.message);
}

// Use memory storage so we can process and compress images in-memory before writing to disk
const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Allow up to 10MB input photos from phone cameras
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WebP) are allowed!'), false);
    }
  },
});

/**
 * Middleware wrapper for single image upload with automatic server-side compression & WebP conversion
 */
const handleImageUpload = (fieldName) => {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);

    singleUpload(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Image upload failed — file exceeds the 10MB size limit.',
          });
        }
        return res.status(400).json({
          success: false,
          message: `Image upload failed — ${err.message}`,
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: `Image upload error: ${err.message}`,
        });
      }

      if (req.file && req.file.buffer) {
        try {
          const randomHex = crypto.randomBytes(8).toString('hex');
          const webpFilename = `menu-${Date.now()}-${randomHex}.webp`;
          const outputPath = path.join(MENU_UPLOADS_DIR, webpFilename);

          // Ensure upload directory exists
          if (!fs.existsSync(MENU_UPLOADS_DIR)) {
            fs.mkdirSync(MENU_UPLOADS_DIR, { recursive: true });
          }

          if (sharp) {
            // Compress, resize to max 700px width, and convert to modern WebP
            await sharp(req.file.buffer)
              .resize({
                width: 700,
                withoutEnlargement: true,
                fit: 'inside',
              })
              .webp({
                quality: 80,
                effort: 4,
              })
              .toFile(outputPath);

            const stats = fs.statSync(outputPath);
            console.log(`[Image Optimizer] Compressed ${req.file.originalname} (${Math.round(req.file.size / 1024)}KB) -> ${webpFilename} (${Math.round(stats.size / 1024)}KB)`);
          } else {
            // Fallback if sharp binary is not available
            fs.writeFileSync(outputPath, req.file.buffer);
          }

          req.file.filename = webpFilename;
          req.file.relativeUrl = `/uploads/menu/${webpFilename}`;
        } catch (compressionErr) {
          console.error('[Image Optimizer Error] Compression failed, saving raw buffer:', compressionErr);
          try {
            const randomHex = crypto.randomBytes(8).toString('hex');
            const fallbackFilename = `menu-${Date.now()}-${randomHex}.jpg`;
            const fallbackPath = path.join(MENU_UPLOADS_DIR, fallbackFilename);
            fs.writeFileSync(fallbackPath, req.file.buffer);
            req.file.filename = fallbackFilename;
            req.file.relativeUrl = `/uploads/menu/${fallbackFilename}`;
          } catch (writeErr) {
            return res.status(500).json({ success: false, message: 'Failed to write uploaded image.' });
          }
        }
      }

      next();
    });
  };
};

module.exports = {
  upload,
  handleImageUpload,
};
