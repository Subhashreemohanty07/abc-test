import cloudinary from "../config/cloudinary.js";

// Get configured storage provider
const getStorageProvider = () => {
  return process.env.IMAGE_STORAGE_PROVIDER || "cloudinary";
};

// Upload image to Cloudinary
const uploadToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "nykaa-products",
        resource_type: "image",
        transformation: [
          {
            width: 1600,
            height: 1600,
            crop: "limit"
          },
          {
            quality: "auto:good"
          }
        ],
        format: "webp"
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          provider: "cloudinary"
        });
      }
    );

    uploadStream.end(file.buffer);
  });
};

// Common image upload function
export const uploadImage = async (
  file,
  {
    color = null,
    isPrimary = false,
    sortOrder = 0
  } = {}
) => {
  if (!file?.buffer) {
    throw new Error("Invalid image file");
  }

  const provider = getStorageProvider();

  if (provider !== "cloudinary") {
    throw new Error(
      `Storage provider ${provider} is not configured`
    );
  }

  const uploadedImage = await uploadToCloudinary(file);

  return {
    ...uploadedImage,
    color,
    isPrimary,
    sortOrder
  };
};

// Common image deletion function
export const deleteImage = async (image) => {
  if (!image?.publicId) return;

  const provider = image.provider || "cloudinary";

  if (provider !== "cloudinary") {
    throw new Error(
      `Storage provider ${provider} is not configured`
    );
  }

  return await cloudinary.uploader.destroy(
    image.publicId,
    {
      resource_type: "image",
      invalidate: true
    }
  );
};