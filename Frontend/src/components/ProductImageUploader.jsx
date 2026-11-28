import { useEffect, useState } from "react";
import { COLOR_OPTIONS } from "../constants/productOptions";
import { compressImage } from "../utils/compressImage";

const MAX_IMAGES_PER_COLOR = 5;

const DEFAULT_THEME = {
  primary: "#D93620",
  light: "#FFF1EB",
  border: "#F4DCD3",
  background: "#FFF8F4",
  text: "#2D202E"
};

// Image preview with automatic URL cleanup
function ImagePreview({ image, color }) {
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!image.file) {
      setPreview(image.url || "");
      return;
    }

    const objectUrl = URL.createObjectURL(image.file);
    setPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [image.file, image.url]);

  return (
    <img
      src={preview || undefined}
      alt={`${color} product`}
      className="w-100 rounded-top"
      style={{
        height: "140px",
        objectFit: "contain",
        backgroundColor: "#F8F9FA"
      }}
    />
  );
}

function ProductImageUploader({
  selectedColors = [],
  images = [],
  onChange,
  processing = false,
  onProcessingChange,
  disabled = false,
  theme = DEFAULT_THEME
}) {
  const [error, setError] = useState("");
  const [activeColor, setActiveColor] = useState(null);

  const colors = { ...DEFAULT_THEME, ...theme };
  const isDisabled = disabled || processing;

  // Get images belonging to a selected colour
  const getColorImages = (color) => {
    return images.filter((image) => image.color === color);
  };

  // Format file size
  const formatSize = (bytes) => {
    if (!bytes) return "";

    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  // Upload and compress images
  async function handleImageChange(event, color) {
    const files = Array.from(event.target.files);

    event.target.value = "";

    if (!files.length || isDisabled) return;

    setError("");

    const existingImages = getColorImages(color);

    if (
      existingImages.length + files.length >
      MAX_IMAGES_PER_COLOR
    ) {
      setError(
        `Maximum 5 images allowed for ${color}.`
      );
      return;
    }

    try {
      onProcessingChange?.(true);
      setActiveColor(color);

      const compressedImages = [];

      for (const file of files) {
        const compressedFile = await compressImage(file);

        compressedImages.push({
          id: crypto.randomUUID(),
          file: compressedFile,
          color,
          originalSize: file.size,
          compressedSize: compressedFile.size
        });
      }

      onChange((previousImages) => [
        ...previousImages,
        ...compressedImages
      ]);

    } catch (error) {
      setError(
        error.message || "Unable to compress images."
      );
    } finally {
      setActiveColor(null);
      onProcessingChange?.(false);
    }
  }

  // Remove an individual image
  function handleRemove(imageId) {
    onChange((previousImages) =>
      previousImages.filter(
        (image) => image.id !== imageId
      )
    );

    setError("");
  }

  // Rearrange images within the same colour
  function handleMove(color, index, direction) {
    const colorImages = getColorImages(color);
    const newIndex = index + direction;

    if (
      newIndex < 0 ||
      newIndex >= colorImages.length
    ) {
      return;
    }

    const reorderedImages = [...colorImages];

    [
      reorderedImages[index],
      reorderedImages[newIndex]
    ] = [
      reorderedImages[newIndex],
      reorderedImages[index]
    ];

    onChange((previousImages) => [
      ...previousImages.filter(
        (image) => image.color !== color
      ),
      ...reorderedImages
    ]);
  }

  // Move selected image to first position
  function handleSetPrimary(color, imageId) {
    const colorImages = getColorImages(color);

    const selectedImage = colorImages.find(
      (image) => image.id === imageId
    );

    if (!selectedImage) return;

    onChange((previousImages) => [
      ...previousImages.filter(
        (image) => image.color !== color
      ),
      selectedImage,
      ...colorImages.filter(
        (image) => image.id !== imageId
      )
    ]);
  }

  // Replace a selected image
  async function handleReplace(event, imageId, color) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file || isDisabled) return;

    try {
      setError("");
      onProcessingChange?.(true);
      setActiveColor(color);

      const compressedFile = await compressImage(file);

      onChange((previousImages) =>
        previousImages.map((image) =>
          image.id === imageId
            ? {
                id: image.id,
                color,
                file: compressedFile,
                originalSize: file.size,
                compressedSize: compressedFile.size
              }
            : image
        )
      );

    } catch (error) {
      setError(error.message);
    } finally {
      setActiveColor(null);
      onProcessingChange?.(false);
    }
  }

  return (
    <div className="col-12 text-start">

      {/* Section heading */}
      <div
        className="rounded-3 p-3 mb-3"
        style={{
          backgroundColor: colors.light,
          border: `1px solid ${colors.border}`
        }}
      >
        <div className="d-flex align-items-center gap-2">
          <i
            className="bi bi-images fs-4"
            style={{ color: colors.primary }}
          />

          <div>
            <h6
              className="fw-bold mb-1"
              style={{ color: colors.text }}
            >
              Product Images *
            </h6>

            <small className="text-secondary">
              Upload 1–5 images for each selected colour.
            </small>
          </div>
        </div>
      </div>

      {/* No colour selected */}
      {!selectedColors.length && (
        <div
          className="rounded-3 p-4 text-center"
          style={{
            border: `2px dashed ${colors.border}`,
            backgroundColor: colors.background
          }}
        >
          <i
            className="bi bi-palette fs-2"
            style={{ color: colors.primary }}
          />

          <p className="mb-0 mt-2 text-secondary">
            Select product colours to upload images.
          </p>
        </div>
      )}

      {/* Colour-wise upload sections */}
      {selectedColors.map((color) => {
        const colorImages = getColorImages(color);

        const colorOption = COLOR_OPTIONS.find(
          (option) => option.name === color
        );

        return (
          <div
            key={color}
            className="rounded-4 p-3 mb-3"
            style={{
              border: `1px solid ${colors.border}`,
              backgroundColor: "#FFFFFF"
            }}
          >

            {/* Colour heading */}
            <div className="d-flex align-items-center justify-content-between mb-3">

              <div className="d-flex align-items-center gap-2">
                <span
                  style={{
                    width: "25px",
                    height: "25px",
                    borderRadius: "50%",
                    background: colorOption?.hex || "#E9ECEF",
                    border: "1px solid #CED4DA"
                  }}
                />

                <span className="fw-semibold">
                  {color}
                </span>
              </div>

              <span
                className="badge rounded-pill px-3 py-2"
                style={{
                  backgroundColor: colors.light,
                  color: colors.primary
                }}
              >
                {colorImages.length} / 5 Images
              </span>

            </div>

            <div className="row g-2">

              {/* Uploaded image cards */}
              {colorImages.map((image, index) => (
                <div
                  key={image.id}
                  className="col-6 col-sm-4 col-lg-3 col-xl-2"
                >
                  <div
                    className="card h-100 overflow-hidden rounded-3"
                    style={{
                      border: index === 0
                        ? `2px solid ${colors.primary}`
                        : `1px solid ${colors.border}`
                    }}
                  >

                    <div className="position-relative">

                      <ImagePreview
                        image={image}
                        color={color}
                      />

                      {index === 0 && (
                        <span
                          className="badge position-absolute top-0 start-0 m-1"
                          style={{
                            backgroundColor: colors.primary
                          }}
                        >
                          <i className="bi bi-star-fill me-1" />
                          Primary
                        </span>
                      )}

                      <button
                        type="button"
                        className="btn btn-danger btn-sm position-absolute top-0 end-0 m-1"
                        onClick={() => handleRemove(image.id)}
                        disabled={isDisabled}
                        title="Remove image"
                      >
                        <i className="bi bi-x-lg" />
                      </button>

                    </div>

                    <div className="card-body p-2">

                      <small className="d-block text-center fw-semibold">
                        Image {index + 1}
                      </small>

                      {image.compressedSize && (
                        <small className="d-block text-center text-success">
                          {formatSize(image.compressedSize)}
                        </small>
                      )}

                      {/* Image ordering */}
                      <div className="d-flex justify-content-center gap-1 mt-2">

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          disabled={index === 0 || isDisabled}
                          onClick={() =>
                            handleMove(color, index, -1)
                          }
                          title="Move left"
                        >
                          <i className="bi bi-arrow-left" />
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          disabled={
                            index === colorImages.length - 1 ||
                            isDisabled
                          }
                          onClick={() =>
                            handleMove(color, index, 1)
                          }
                          title="Move right"
                        >
                          <i className="bi bi-arrow-right" />
                        </button>

                      </div>

                      {/* Primary image selection */}
                      {index !== 0 && (
                        <button
                          type="button"
                          className="btn btn-sm w-100 mt-2"
                          style={{
                            color: colors.primary,
                            border: `1px solid ${colors.primary}`
                          }}
                          disabled={isDisabled}
                          onClick={() =>
                            handleSetPrimary(color, image.id)
                          }
                        >
                          Set Primary
                        </button>
                      )}

                      {/* Replace image */}
                      <label
                        className={`btn btn-sm btn-outline-secondary w-100 mt-2 ${
                          isDisabled ? "disabled" : ""
                        }`}
                      >
                        <i className="bi bi-arrow-repeat me-1" />
                        Replace

                        <input
                          type="file"
                          hidden
                          accept="image/jpeg,image/png,image/webp"
                          disabled={isDisabled}
                          onChange={(event) =>
                            handleReplace(
                              event,
                              image.id,
                              color
                            )
                          }
                        />
                      </label>

                    </div>
                  </div>
                </div>
              ))}

              {/* Add more images */}
              {colorImages.length < MAX_IMAGES_PER_COLOR && (
                <div className="col-6 col-sm-4 col-lg-3 col-xl-2">

                  <label
                    className="rounded-3 d-flex flex-column align-items-center justify-content-center p-3 h-100 text-center"
                    style={{
                      minHeight: "180px",
                      backgroundColor: colors.background,
                      border: `2px dashed ${colors.border}`,
                      cursor: isDisabled
                        ? "not-allowed"
                        : "pointer",
                      opacity: isDisabled ? 0.6 : 1
                    }}
                  >

                    {processing && activeColor === color ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm mb-2"
                          style={{ color: colors.primary }}
                        />

                        <small>Compressing...</small>
                      </>
                    ) : (
                      <>
                        <i
                          className="bi bi-image fs-2"
                          style={{ color: colors.primary }}
                        />

                        <span
                          className="fw-semibold mt-2"
                          style={{ color: colors.primary }}
                        >
                          Add Images
                        </span>

                        <small className="text-secondary">
                          {5 - colorImages.length} slots left
                        </small>
                      </>
                    )}

                    <input
                      type="file"
                      hidden
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      disabled={isDisabled}
                      onChange={(event) =>
                        handleImageChange(event, color)
                      }
                    />

                  </label>
                </div>
              )}

            </div>
          </div>
        );
      })}

      {/* Error message */}
      {error && (
        <div className="alert alert-danger py-2">
          {error}
        </div>
      )}

      {/* Upload instructions */}
      <div className="small text-secondary">
        <i className="bi bi-info-circle me-1" />
        JPG, PNG and WEBP supported. Maximum original
        size 10 MB per image. Images are automatically
        compressed before uploading.
      </div>

      {/* Total image count */}
      <div
        className="rounded-3 p-2 mt-3 small"
        style={{
          backgroundColor: colors.light,
          color: colors.text
        }}
      >
        <span className="fw-semibold">
          Total Images:
        </span>{" "}
        {images.length}

        <span className="ms-3 fw-semibold">
          Upload Size:
        </span>{" "}
        {formatSize(
          images.reduce(
            (total, image) =>
              total + (image.file?.size || 0),
            0
          )
        ) || "0 KB"}
      </div>

    </div>
  );
}

export default ProductImageUploader;