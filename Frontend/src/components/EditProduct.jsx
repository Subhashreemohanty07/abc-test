import { useEffect, useState } from "react";
import SizeSelector from "./SizeSelector";
import ColorSelector from "./ColorSelector";
import ProductImageUploader from "./ProductImageUploader";

import VariantStockManager, {
  generateVariants,
  calculateTotalStock
} from "./VariantStockManager";

const API_URL = import.meta.env.VITE_API_URL;

const MAX_IMAGES_PER_COLOR = 5;
const MAX_PRODUCT_IMAGES = 30;
const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;

// Default vendor theme
const DEFAULT_THEME = {
  primary: "#D93620",
  primaryDark: "#B92D1B",
  light: "#FFF1EB",
  border: "#F4DCD3",
  background: "#FFF8F4",
  text: "#2D202E",
  gradient: "linear-gradient(180deg, #E65A20, #D93620)",
  lightGradient: "linear-gradient(135deg, #FFF1EB, #FFE2D5)",
  shadow: "0 4px 10px rgba(217,54,32,0.18)"
};

// Convert existing values into arrays
const normalizeArray = (value) => [
  ...new Set(
    (Array.isArray(value)
      ? value
      : String(value || "").split(",")
    )
      .map((item) => String(item).trim())
      .filter(Boolean)
  )
];

function EditProduct({
  product,
  onClose,
  onUpdated,
  theme = DEFAULT_THEME
}) {
  const colors = {
    ...DEFAULT_THEME,
    ...theme
  };

  const [editForm, setEditForm] = useState({
    productName: "",
    description: "",
    category: "men",
    subCategory: "",
    brand: "",
    price: "",
    discountPrice: "",
    sizes: [],
    colors: [],
    variants: []
  });

  // Image management
  const [images, setImages] = useState([]);
  const [compressing, setCompressing] = useState(false);

  // Request states
  const [updating, setUpdating] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState("");

  // Version conflict management
  const [originalVersion, setOriginalVersion] =
    useState(null);

  const [versionConflict, setVersionConflict] =
    useState(false);

  const [latestProduct, setLatestProduct] =
    useState(null);

  const currentProduct =
    latestProduct &&
    latestProduct._id === product?._id
      ? latestProduct
      : product;

  const isBusy =
    updating || reloading || compressing;

  const isLegacyProduct = Boolean(
    currentProduct &&
    !currentProduct.variants?.length
  );

  const originalStock = Number(
    currentProduct?.stock ?? 0
  );

  const totalStock = calculateTotalStock(
    editForm.variants
  );

  // Images without a valid selected colour
  const unassignedImages = images.filter(
    (image) =>
      !image.color ||
      !editForm.colors.includes(image.color)
  );

  // Calculate only newly uploaded image size
  const totalNewImageSize = images.reduce(
    (total, image) =>
      total + (image.file?.size || 0),
    0
  );

  // Reset when another product is selected
  useEffect(() => {
    setLatestProduct(null);
  }, [product?._id]);

  // Load existing product details
  useEffect(() => {
    if (!currentProduct) return;

    const existingSizes = normalizeArray(
      currentProduct.sizes
    );

    const existingColors = normalizeArray(
      currentProduct.colors
    );

    const existingVariants = Array.isArray(
      currentProduct.variants
    )
      ? currentProduct.variants
      : [];

    setEditForm({
      productName: currentProduct.productName || "",
      description: currentProduct.description || "",
      category: currentProduct.category || "men",
      subCategory: currentProduct.subCategory || "",
      brand: currentProduct.brand || "",
      price: currentProduct.price ?? "",
      discountPrice: currentProduct.discountPrice ?? "",
      sizes: existingSizes,
      colors: existingColors,

      variants: generateVariants(
        existingSizes,
        existingColors,
        existingVariants
      )
    });

    // Load existing images without downloading
    // or reuploading them
    const existingImages = (
      currentProduct.images || []
    )
      .map((image, index) => ({
        id: image._id
          ? String(image._id)
          : `legacy-${index}`,

        existingId: image._id
          ? String(image._id)
          : null,

        url: image.url,
        publicId: image.publicId || null,
        provider: image.provider || "cloudinary",

        color: existingColors.includes(image.color)
          ? image.color
          : null,

        isPrimary: Boolean(image.isPrimary),
        sortOrder: image.sortOrder ?? index
      }))
      .sort(
        (first, second) =>
          first.sortOrder - second.sortOrder
      );

    setImages(existingImages);

    const version = currentProduct.__v;

    const validVersion =
      Number.isSafeInteger(version) &&
      version >= 0;

    setOriginalVersion(
      validVersion ? version : null
    );

    setVersionConflict(!validVersion);

    setError(
      validVersion
        ? ""
        : "Product version is unavailable. Please reload the latest product."
    );
  }, [currentProduct]);

  // Handle normal input changes
  const handleEditChange = (event) => {
    const { name, value } = event.target;

    setEditForm((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  // Handle size selection
  const handleSizeChange = (updatedSizes) => {
    if (isBusy || versionConflict) return;

    setEditForm((previous) => ({
      ...previous,
      sizes: updatedSizes,

      variants: generateVariants(
        updatedSizes,
        previous.colors,
        previous.variants
      )
    }));
  };

  // Handle colour selection
  const handleColorChange = (updatedColors) => {
    if (isBusy || versionConflict) return;

    const removedColors = editForm.colors.filter(
      (color) => !updatedColors.includes(color)
    );

    const affectedImages = images.filter(
      (image) => removedColors.includes(image.color)
    );

    if (affectedImages.length > 0) {
      const confirmed = window.confirm(
        `Removing these colours will also remove ${affectedImages.length} associated image(s) when you save. Do you want to continue?`
      );

      if (!confirmed) return;
    }

    setEditForm((previous) => ({
      ...previous,
      colors: updatedColors,

      variants: generateVariants(
        previous.sizes,
        updatedColors,
        previous.variants
      )
    }));

    // Remove images belonging to removed colours.
    // Cloudinary deletion happens only after saving.
    setImages((previous) =>
      previous.filter(
        (image) =>
          !removedColors.includes(image.color)
      )
    );
  };

  // Handle variant stock changes
  const handleVariantChange = (updatedVariants) => {
    if (isBusy || versionConflict) return;

    setEditForm((previous) => ({
      ...previous,
      variants: updatedVariants
    }));
  };

  // Assign legacy images to selected colours
  const handleAssignImageColor = (
    imageId,
    selectedColor
  ) => {
    if (
      isBusy ||
      versionConflict ||
      !editForm.colors.includes(selectedColor)
    ) {
      return;
    }

    const colorImages = images.filter(
      (image) => image.color === selectedColor
    );

    if (
      colorImages.length >= MAX_IMAGES_PER_COLOR
    ) {
      setError(
        `Maximum ${MAX_IMAGES_PER_COLOR} images allowed for ${selectedColor}.`
      );

      return;
    }

    setImages((previous) => {
      const selectedImage = previous.find(
        (image) => image.id === imageId
      );

      if (!selectedImage) return previous;

      return [
        ...previous.filter(
          (image) => image.id !== imageId
        ),
        {
          ...selectedImage,
          color: selectedColor
        }
      ];
    });

    setError("");
  };

  // Remove an unassigned legacy image
  const handleRemoveUnassignedImage = (imageId) => {
    if (isBusy || versionConflict) return;

    const confirmed = window.confirm(
      "This image will be removed when you save the product. Continue?"
    );

    if (!confirmed) return;

    setImages((previous) =>
      previous.filter(
        (image) => image.id !== imageId
      )
    );
  };

  // Reload latest product without page refresh
  const handleReloadProduct = async () => {
    if (!product?._id || isBusy) return;

    const confirmed = window.confirm(
      "Reloading will discard your unsaved changes, including image changes. Do you want to continue?"
    );

    if (!confirmed) return;

    setReloading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Please sign in again.");
      }

      const response = await fetch(
        `${API_URL}/api/products/${product._id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          },
          cache: "no-store"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to reload product."
        );
      }

      const freshProduct =
        data.product ?? data.data ?? data;

      if (
        freshProduct?._id !== product._id ||
        !Number.isSafeInteger(freshProduct?.__v) ||
        freshProduct.__v < 0
      ) {
        throw new Error(
          "Latest product information is unavailable."
        );
      }

      setLatestProduct(freshProduct);

    } catch (error) {
      setError(error.message);
    } finally {
      setReloading(false);
    }
  };

  // Validate image information before saving
  const validateImages = () => {
    if (unassignedImages.length > 0) {
      return "Please assign a colour to every existing image or remove unwanted images.";
    }

    if (images.length > MAX_PRODUCT_IMAGES) {
      return `Maximum ${MAX_PRODUCT_IMAGES} images are allowed per product.`;
    }

    for (const color of editForm.colors) {
      const colorImages = images.filter(
        (image) => image.color === color
      );

      if (colorImages.length === 0) {
        return `Please add at least one image for ${color}.`;
      }

      if (
        colorImages.length > MAX_IMAGES_PER_COLOR
      ) {
        return `Maximum ${MAX_IMAGES_PER_COLOR} images allowed for ${color}.`;
      }
    }

    if (
      images.some(
        (image) =>
          !image.file && !image.existingId
      )
    ) {
      return "An existing image has no valid image ID. Please remove or replace it.";
    }

    if (totalNewImageSize > MAX_UPLOAD_SIZE) {
      return "New images must not exceed 4 MB in total. Please reduce the number or size of new images.";
    }

    return "";
  };

  // Update product
  const handleUpdateProduct = async (event) => {
    event.preventDefault();

    if (
      !product?._id ||
      isBusy ||
      versionConflict
    ) {
      return;
    }

    setError("");

    // Validate product version
    if (
      !Number.isSafeInteger(originalVersion) ||
      originalVersion < 0
    ) {
      setError(
        "Product version is unavailable. Please reload the product."
      );

      setVersionConflict(true);
      return;
    }

    // Validate product name
    if (!editForm.productName.trim()) {
      setError("Please enter the product name.");
      return;
    }

    // Validate price
    if (
      editForm.price === "" ||
      !Number.isFinite(Number(editForm.price)) ||
      Number(editForm.price) < 0
    ) {
      setError("Please enter a valid product price.");
      return;
    }

    // Validate discount price
    if (
      editForm.discountPrice !== "" &&
      (
        !Number.isFinite(
          Number(editForm.discountPrice)
        ) ||
        Number(editForm.discountPrice) < 0 ||
        Number(editForm.discountPrice) >
          Number(editForm.price)
      )
    ) {
      setError(
        "Discount price must be between zero and the original price."
      );

      return;
    }

    // Validate selected sizes
    if (!editForm.sizes.length) {
      setError("Please select at least one size.");
      return;
    }

    // Validate selected colours
    if (!editForm.colors.length) {
      setError("Please select at least one colour.");
      return;
    }

    // Validate variant inventory
    if (!editForm.variants.length) {
      setError(
        "Please configure product variant inventory."
      );

      return;
    }

    const invalidVariant = editForm.variants.some(
      (variant) =>
        variant.stock === "" ||
        !Number.isSafeInteger(variant.stock) ||
        variant.stock < 0
    );

    if (invalidVariant) {
      setError(
        "Please enter a valid whole-number stock for every variant."
      );

      return;
    }

    if (!Number.isSafeInteger(totalStock)) {
      setError("Invalid total stock quantity.");
      return;
    }

    // Prevent legacy inventory loss
    if (
      isLegacyProduct &&
      totalStock !== originalStock
    ) {
      setError(
        `Please distribute the existing ${originalStock} stock units among the size-colour combinations. Current allocated stock: ${totalStock}.`
      );

      return;
    }

    // Validate images
    const imageError = validateImages();

    if (imageError) {
      setError(imageError);
      return;
    }

    // Confirm removal of variants containing stock
    if (!isLegacyProduct) {
      const removedStock = (
        currentProduct.variants || []
      )
        .filter(
          (oldVariant) =>
            !editForm.variants.some(
              (newVariant) =>
                newVariant.size === oldVariant.size &&
                newVariant.color === oldVariant.color
            )
        )
        .reduce(
          (total, variant) =>
            total + Number(variant.stock || 0),
          0
        );

      if (removedStock > 0) {
        const confirmed = window.confirm(
          `Removing selected sizes or colours will remove variants containing ${removedStock} stock units. Do you want to continue?`
        );

        if (!confirmed) return;
      }
    }

    setUpdating(true);

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Please sign in again.");
      }

      const formData = new FormData();

      const productPayload = {
        ...editForm,
        stock: totalStock,
        expectedVersion: originalVersion
      };

      // Append normal product information
      Object.entries(productPayload).forEach(
        ([key, value]) => {
          if (Array.isArray(value)) {
            formData.append(
              key,
              JSON.stringify(value)
            );
          } else {
            formData.append(key, value);
          }
        }
      );

      // Prepare image manifest
      const imageManifest = [];

      let fileIndex = 0;

      // Preserve image ordering within each colour
      for (const color of editForm.colors) {
        const colorImages = images.filter(
          (image) => image.color === color
        );

        for (const image of colorImages) {

          // Newly added or replaced image
          if (image.file) {
            formData.append(
              "images",
              image.file
            );

            imageManifest.push({
              type: "new",
              fileIndex,
              color
            });

            fileIndex += 1;

          } else {

            // Retain existing Cloudinary image
            imageManifest.push({
              type: "existing",
              imageId: image.existingId,
              color
            });
          }
        }
      }

      // Send complete final image arrangement
      formData.append(
        "imageManifest",
        JSON.stringify(imageManifest)
      );

      // Send update request
      const response = await fetch(
        `${API_URL}/api/products/${product._id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      // Handle concurrent product update
      if (response.status === 409) {
        setVersionConflict(true);

        throw new Error(
          data.message ||
          "Product information has changed. Please reload the latest product."
        );
      }

      // Handle Vercel request size limit
      if (response.status === 413) {
        throw new Error(
          "Upload size is too large. Please reduce the size of new images."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to update product."
        );
      }

      const updatedProduct =
        data.product || data.data || data;

      onUpdated?.(updatedProduct);
      onClose();

    } catch (error) {
      setError(error.message);
    } finally {
      setUpdating(false);
    }
  };

  if (!product) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center p-3"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 1050,
        overflowY: "auto"
      }}
    >
      <div
        className="rounded-4 shadow p-3 p-md-4 w-100"
        style={{
          backgroundColor: colors.background,
          maxWidth: "950px",
          maxHeight: "90vh",
          overflowY: "auto"
        }}
      >

        {/* Modal Header */}
        <div
          className="d-flex justify-content-between align-items-center rounded-3 p-3 mb-4"
          style={{
            background: colors.lightGradient,
            border: `1px solid ${colors.border}`
          }}
        >
          <div className="d-flex align-items-center gap-3">

            <div
              className="rounded-3 p-3 text-white flex-shrink-0"
              style={{
                background: colors.gradient,
                boxShadow: colors.shadow
              }}
            >
              <i className="bi bi-pencil-square fs-4"></i>
            </div>

            <div>
              <h5
                className="fw-bold mb-1"
                style={{
                  color: colors.text
                }}
              >
                Edit Product
              </h5>

              <p className="text-secondary small mb-0">
                Update product details, images and inventory
              </p>
            </div>

          </div>

          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}

        <form
          onSubmit={handleUpdateProduct}
          className="text-start"
        >

          <fieldset
            disabled={isBusy || versionConflict}
            className="border-0 p-0 m-0"
          >

            {/* Product Name */}
            <div className="mb-3">
              <label className="form-label fw-semibold">
                Product Name
              </label>

              <input
                type="text"
                name="productName"
                className="form-control rounded-3 py-2"
                value={editForm.productName}
                onChange={handleEditChange}
                required
              />
            </div>

            {/* Description */}
            <div className="mb-3">
              <label className="form-label fw-semibold">
                Description
              </label>

              <textarea
                name="description"
                className="form-control rounded-3 py-2"
                rows="3"
                value={editForm.description}
                onChange={handleEditChange}
              />
            </div>

            {/* Category and Subcategory */}
            <div className="row">

              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">
                  Category
                </label>

                <select
                  name="category"
                  className="form-select rounded-3 py-2"
                  value={editForm.category}
                  onChange={handleEditChange}
                  required
                >
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                </select>
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">
                  Sub Category
                </label>

                <input
                  type="text"
                  name="subCategory"
                  className="form-control rounded-3 py-2"
                  value={editForm.subCategory}
                  onChange={handleEditChange}
                />
              </div>

            </div>

            {/* Brand */}
            <div className="mb-3">
              <label className="form-label fw-semibold">
                Brand
              </label>

              <input
                type="text"
                name="brand"
                className="form-control rounded-3 py-2"
                value={editForm.brand}
                onChange={handleEditChange}
              />
            </div>

            {/* Price and Discount Price */}
            <div className="row">

              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">
                  Price (₹)
                </label>

                <input
                  type="number"
                  name="price"
                  className="form-control rounded-3 py-2"
                  min="0"
                  step="0.01"
                  value={editForm.price}
                  onChange={handleEditChange}
                  required
                />
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">
                  Discount Price (₹)
                </label>

                <input
                  type="number"
                  name="discountPrice"
                  className="form-control rounded-3 py-2"
                  min="0"
                  step="0.01"
                  value={editForm.discountPrice}
                  onChange={handleEditChange}
                />
              </div>

            </div>

            {/* Size Selector */}
            <div className="mb-3">
              <SizeSelector
                selectedSizes={editForm.sizes}
                onChange={handleSizeChange}
                theme={colors}
              />
            </div>

            {/* Colour Selector */}
            <div className="mb-3">
              <ColorSelector
                selectedColors={editForm.colors}
                onChange={handleColorChange}
                theme={colors}
              />
            </div>

            {/* Legacy Images */}
            {unassignedImages.length > 0 && (
              <div className="alert alert-warning mb-4">

                <h6 className="fw-bold">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Existing Images Need Colour Assignment
                </h6>

                <p className="small mb-3">
                  These images were uploaded without colour
                  information. Assign each image to its
                  correct colour or remove it.
                </p>

                <div className="row g-3">

                  {unassignedImages.map((image) => (
                    <div
                      className="col-6 col-md-4"
                      key={image.id}
                    >
                      <div className="card border-0 shadow-sm h-100">

                        <img
                          src={image.url}
                          alt="Unassigned product"
                          className="card-img-top"
                          style={{
                            height: "150px",
                            objectFit: "contain",
                            backgroundColor: "#F8F9FA"
                          }}
                        />

                        <div className="card-body p-2">

                          <select
                            className="form-select form-select-sm mb-2"
                            value=""
                            onChange={(event) =>
                              handleAssignImageColor(
                                image.id,
                                event.target.value
                              )
                            }
                          >
                            <option value="">
                              Assign Colour
                            </option>

                            {editForm.colors.map(
                              (color) => (
                                <option
                                  key={color}
                                  value={color}
                                >
                                  {color}
                                </option>
                              )
                            )}

                          </select>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger w-100"
                            onClick={() =>
                              handleRemoveUnassignedImage(
                                image.id
                              )
                            }
                          >
                            <i className="bi bi-trash me-1"></i>
                            Remove
                          </button>

                        </div>
                      </div>
                    </div>
                  ))}

                </div>
              </div>
            )}

            {/* Colour-wise Product Images */}
            <div
              className="rounded-3 p-3 mb-4 bg-white"
              style={{
                border: `1px solid ${colors.border}`
              }}
            >

              <div className="d-flex align-items-center gap-2 mb-3">

                <div
                  className="rounded-3 p-2"
                  style={{
                    backgroundColor: colors.light,
                    color: colors.primary
                  }}
                >
                  <i className="bi bi-images fs-5"></i>
                </div>

                <div>
                  <h6
                    className="fw-bold mb-1"
                    style={{
                      color: colors.text
                    }}
                  >
                    Manage Product Images
                  </h6>

                  <p className="small text-secondary mb-0">
                    Add, replace, remove and reorder images
                  </p>
                </div>

              </div>

              <div
                className="rounded-3 p-2 mb-3 small"
                style={{
                  backgroundColor: colors.light,
                  color: colors.text
                }}
              >
                <i className="bi bi-info-circle me-2"></i>

                Existing images will not be uploaded again.
                Image changes are applied only after
                saving the product.
              </div>

              <ProductImageUploader
                selectedColors={editForm.colors}
                images={images}
                onChange={setImages}
                processing={compressing}
                onProcessingChange={setCompressing}
                disabled={
                  updating ||
                  reloading ||
                  versionConflict
                }
                theme={colors}
              />

              {/* Image Summary */}
              <div
                className="rounded-3 p-3 mt-3"
                style={{
                  backgroundColor: colors.background,
                  border: `1px solid ${colors.border}`
                }}
              >
                <div className="row text-center g-2">

                  <div className="col-4">
                    <div className="small text-secondary">
                      Existing
                    </div>

                    <div
                      className="fw-bold fs-5"
                      style={{
                        color: colors.primary
                      }}
                    >
                      {
                        images.filter(
                          (image) => !image.file
                        ).length
                      }
                    </div>
                  </div>

                  <div className="col-4">
                    <div className="small text-secondary">
                      New Uploads
                    </div>

                    <div className="fw-bold fs-5 text-success">
                      {
                        images.filter(
                          (image) => image.file
                        ).length
                      }
                    </div>
                  </div>

                  <div className="col-4">
                    <div className="small text-secondary">
                      Total Images
                    </div>

                    <div
                      className={`fw-bold fs-5 ${
                        images.length > MAX_PRODUCT_IMAGES
                          ? "text-danger"
                          : ""
                      }`}
                    >
                      {images.length}/{MAX_PRODUCT_IMAGES}
                    </div>
                  </div>

                </div>

                <hr />

                <div className="d-flex justify-content-between small">
                  <span className="text-secondary">
                    New Upload Size
                  </span>

                  <strong
                    className={
                      totalNewImageSize > MAX_UPLOAD_SIZE
                        ? "text-danger"
                        : "text-success"
                    }
                  >
                    {
                      (
                        totalNewImageSize / (1024 * 1024)
                      ).toFixed(2)
                    } MB / 4 MB
                  </strong>
                </div>

                {totalNewImageSize > MAX_UPLOAD_SIZE && (
                  <div className="text-danger small mt-2">
                    Please reduce the total size of new images.
                  </div>
                )}

                {images.length > MAX_PRODUCT_IMAGES && (
                  <div className="text-danger small mt-2">
                    Maximum 30 images allowed per product.
                  </div>
                )}

              </div>

            </div>

            {/* Legacy Inventory Migration */}
            {isLegacyProduct && (
              <div className="alert alert-warning mb-3">

                <h6 className="fw-bold">
                  Inventory Upgrade Required
                </h6>

                <p className="small mb-2">
                  This product was created before size and
                  colour-wise inventory was introduced.
                  Please distribute the existing stock
                  among the correct size-colour combinations.
                </p>

                <div className="d-flex justify-content-between">
                  <span>Existing Stock:</span>
                  <strong>{originalStock}</strong>
                </div>

                <div className="d-flex justify-content-between">
                  <span>Allocated Stock:</span>
                  <strong>{totalStock}</strong>
                </div>

                <div className="d-flex justify-content-between">

                  <span>
                    {totalStock > originalStock
                      ? "Excess Allocation:"
                      : "Remaining Stock:"}
                  </span>

                  <strong
                    className={
                      totalStock === originalStock
                        ? "text-success"
                        : "text-danger"
                    }
                  >
                    {
                      Math.abs(
                        originalStock - totalStock
                      )
                    }
                  </strong>

                </div>

                {totalStock === originalStock && (
                  <div className="small text-success mt-2">
                    Stock allocation is complete.
                  </div>
                )}

              </div>
            )}

            {/* Variant Inventory */}
            <div className="mb-4">
              <VariantStockManager
                variants={editForm.variants}
                onChange={handleVariantChange}
                theme={colors}
              />
            </div>

            {/* Stock Summary */}
            {!isLegacyProduct && (
              <div
                className="rounded-3 p-3 mb-4 bg-white"
                style={{
                  border: `1px solid ${colors.border}`
                }}
              >

                <h6
                  className="fw-bold mb-3"
                  style={{
                    color: colors.text
                  }}
                >
                  <i className="bi bi-boxes me-2"></i>
                  Stock Summary
                </h6>

                <div className="d-flex justify-content-between mb-2">
                  <span className="text-secondary">
                    Previous Total Stock:
                  </span>

                  <strong>{originalStock}</strong>
                </div>

                <div className="d-flex justify-content-between mb-2">
                  <span className="text-secondary">
                    Updated Total Stock:
                  </span>

                  <strong
                    style={{
                      color: colors.primary
                    }}
                  >
                    {totalStock}
                  </strong>
                </div>

                <hr
                  style={{
                    borderColor: colors.border
                  }}
                />

                <div className="d-flex justify-content-between">

                  <span className="fw-semibold">
                    Stock Change:
                  </span>

                  <strong
                    className={
                      totalStock > originalStock
                        ? "text-success"
                        : totalStock < originalStock
                          ? "text-danger"
                          : "text-secondary"
                    }
                  >
                    {totalStock > originalStock ? "+" : ""}
                    {totalStock - originalStock}
                  </strong>

                </div>

              </div>
            )}

          </fieldset>

          {/* Image Processing Message */}
          {compressing && (
            <div className="alert alert-info d-flex align-items-center gap-2">

              <span className="spinner-border spinner-border-sm"></span>

              Compressing images. Please wait...

            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="alert alert-danger">
              {error}
            </div>
          )}

          {/* Product Version Conflict */}
          {versionConflict && (
            <div className="alert alert-warning mb-3">

              <h6 className="fw-bold">
                <i className="bi bi-exclamation-triangle me-2"></i>

                {originalVersion === null
                  ? "Product Version Unavailable"
                  : "Product Information Changed"}
              </h6>

              <p className="small mb-3">
                {originalVersion === null
                  ? "The product version is unavailable. Please reload the latest product information."
                  : "Another operation has updated this product. A customer may have purchased or cancelled an order, or another user may have edited the product."}
              </p>

              <p className="small mb-3">
                To prevent incorrect inventory or image
                updates, saving has been disabled.
                Please reload the latest product.
              </p>

              <button
                type="button"
                className="btn btn-sm btn-outline-dark"
                onClick={handleReloadProduct}
                disabled={isBusy}
              >
                <i className="bi bi-arrow-clockwise me-2"></i>

                {reloading
                  ? "Reloading..."
                  : "Reload Latest Product"}
              </button>

            </div>
          )}

          {/* Form Buttons */}
          <div className="d-flex justify-content-end flex-wrap gap-2">

            <button
              type="button"
              className="btn fw-semibold rounded-3 px-4 py-2"
              style={{
                backgroundColor: "#FFFFFF",
                color: colors.primary,
                border: `1px solid ${colors.primary}`
              }}
              onClick={onClose}
              disabled={isBusy}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn text-white fw-semibold rounded-3 px-4 py-2"
              style={{
                background: colors.gradient,
                border: "none",
                boxShadow: colors.shadow
              }}
              disabled={
                isBusy ||
                versionConflict ||
                originalVersion === null ||
                unassignedImages.length > 0 ||
                images.length > MAX_PRODUCT_IMAGES ||
                totalNewImageSize > MAX_UPLOAD_SIZE
              }
            >

              {updating ? (
                <span className="spinner-border spinner-border-sm me-2"></span>
              ) : (
                <i className="bi bi-check-circle me-2"></i>
              )}

              {updating
                ? "Saving..."
                : compressing
                  ? "Compressing..."
                  : reloading
                    ? "Reloading..."
                    : versionConflict
                      ? "Reload Required"
                      : "Save Changes"}

            </button>

          </div>

        </form>

      </div>
    </div>
  );
}

export default EditProduct;