import multer from "multer";

// Maximum images per colour
export const MAX_IMAGES_PER_COLOR = 5;

// Maximum images per product
export const MAX_PRODUCT_IMAGES = 30;

// Store uploaded images temporarily in memory
const storage = multer.memoryStorage();

// Allow only supported image formats
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only JPG, PNG and WEBP images are allowed"
      )
    );
  }
};

// Configure Multer
const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: MAX_PRODUCT_IMAGES
  }
});

export default upload;