import imageCompression from "browser-image-compression";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

const MAX_ORIGINAL_SIZE = 10 * 1024 * 1024;

export const compressImage = async (file) => {
  if (!file) {
    throw new Error("Please select an image");
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      "Only JPG, PNG and WEBP images are allowed"
    );
  }

  if (file.size > MAX_ORIGINAL_SIZE) {
    throw new Error(
      "Original image must not exceed 10 MB"
    );
  }

  const options = {
    maxSizeMB: 0.25,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.85
  };

  const compressedFile = await imageCompression(
    file,
    options
  );

  if (compressedFile.type !== "image/webp") {
    throw new Error("WebP conversion failed");
  }

  const fileName =
    file.name.replace(/\.[^.]+$/, "") + ".webp";

  return new File(
    [compressedFile],
    fileName,
    {
      type: "image/webp",
      lastModified: Date.now()
    }
  );
};