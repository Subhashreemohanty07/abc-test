import { useEffect, useState } from "react";
import SizeSelector from "./SizeSelector";
import ColorSelector from "./ColorSelector";
import VariantStockManager, {
  generateVariants,
  calculateTotalStock
} from "./VariantStockManager";

const API_URL = import.meta.env.VITE_API_URL;

function EditProduct({ product, onClose, onUpdated }) {
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

  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  // Store original product version
  const [originalVersion, setOriginalVersion] = useState(null);

  // Track inventory version conflict
  const [versionConflict, setVersionConflict] = useState(false);

  // NEW: Store latest product information
  const [latestProduct, setLatestProduct] = useState(null);

  // NEW: Track product reloading status
  const [reloading, setReloading] = useState(false);

  // NEW: Use latest product information when available
  const currentProduct =
    latestProduct && latestProduct._id === product?._id
      ? latestProduct
      : product;

  // Reset latest product when another product is selected
  useEffect(() => {
    setLatestProduct(null);
  }, [product?._id]);

  // Identify existing products without variant inventory
  const isLegacyProduct = Boolean(
    currentProduct && !currentProduct.variants?.length
  );

  // Store the original stock of existing products
  const originalStock = Number(currentProduct?.stock ?? 0);

  // Calculate total stock automatically
  const totalStock = calculateTotalStock(editForm.variants);

  // Load selected product details into the form
  useEffect(() => {
    if (currentProduct) {

      // Convert existing sizes into an array
      const existingSizes = [
        ...new Set(
          (
            Array.isArray(currentProduct.sizes)
              ? currentProduct.sizes
              : (currentProduct.sizes || "").split(",")
          )
            .map((size) => String(size).trim())
            .filter(Boolean)
        )
      ];

      // Convert existing colours into an array
      const existingColors = [
        ...new Set(
          (
            Array.isArray(currentProduct.colors)
              ? currentProduct.colors
              : (currentProduct.colors || "").split(",")
          )
            .map((color) => String(color).trim())
            .filter(Boolean)
        )
      ];

      // Preserve existing variant stock
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

        // Generate variants and preserve existing quantities
        variants: generateVariants(
          existingSizes,
          existingColors,
          existingVariants
        )
      });

      // Store latest product version
      const version = currentProduct.__v;

      const validVersion =
        Number.isSafeInteger(version) && version >= 0;

      setOriginalVersion(validVersion ? version : null);

      // Reset or initialize version conflict
      setVersionConflict(!validVersion);

      setError(
        validVersion
          ? ""
          : "Product version is unavailable. Please reload the product list."
      );
    }
  }, [currentProduct]);

  // Handle normal input changes
  const handleEditChange = (e) => {
    const { name, value } = e.target;

    setEditForm((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  // Handle size selection changes
  const handleSizeChange = (updatedSizes) => {
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

  // Handle colour selection changes
  const handleColorChange = (updatedColors) => {
    setEditForm((previous) => ({
      ...previous,
      colors: updatedColors,

      variants: generateVariants(
        previous.sizes,
        updatedColors,
        previous.variants
      )
    }));
  };

  // Handle individual variant stock changes
  const handleVariantChange = (updatedVariants) => {
    setEditForm((previous) => ({
      ...previous,
      variants: updatedVariants
    }));
  };

  // NEW: Reload only the latest product information
  const handleReloadProduct = async () => {
    if (!product?._id || reloading || updating) return;

    const confirmed = window.confirm(
      "Reloading will discard your unsaved changes. Do you want to continue?"
    );

    if (!confirmed) return;

    setReloading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Please sign in again.");
      }

      // Fetch latest product information
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

      // Support different API response structures
      const freshProduct =
        data.product ?? data.data ?? data;

      // Validate latest product information
      if (
        freshProduct?._id !== product._id ||
        !Number.isSafeInteger(freshProduct?.__v) ||
        freshProduct.__v < 0
      ) {
        throw new Error(
          "Latest product information is unavailable."
        );
      }

      // Update the modal without refreshing the entire page
      setLatestProduct(freshProduct);

      // useEffect will automatically update the form,
      // stock, version and conflict status

    } catch (error) {
      setError(error.message);
    } finally {
      setReloading(false);
    }
  };

  // Update product
  const handleUpdateProduct = async (e) => {
    e.preventDefault();

    // Prevent saving outdated product information
    if (
      !product?._id ||
      updating ||
      reloading ||
      versionConflict
    ) {
      return;
    }

    setError("");

    // Validate original product version
    if (
      !Number.isSafeInteger(originalVersion) ||
      originalVersion < 0
    ) {
      setError(
        "Product version is unavailable. Please refresh the product list."
      );

      setVersionConflict(true);
      return;
    }

    // Validate product name
    if (!editForm.productName.trim()) {
      setError("Please enter the product name.");
      return;
    }

    // Validate original price
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
        !Number.isFinite(Number(editForm.discountPrice)) ||
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
      setError("Please configure product variant inventory.");
      return;
    }

    // Validate every variant stock
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

    // Validate calculated total stock
    if (!Number.isSafeInteger(totalStock)) {
      setError("Invalid total stock quantity.");
      return;
    }

    // Prevent accidental stock loss during legacy migration
    if (isLegacyProduct && totalStock !== originalStock) {
      setError(
        `Please distribute the existing ${originalStock} stock units among the size-colour combinations. Current allocated stock: ${totalStock}.`
      );

      return;
    }

    // Confirm if existing inventory is being removed
    if (!isLegacyProduct) {

      // Use latest product inventory
      const removedStock = (currentProduct.variants || [])
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
          `Removing the selected sizes or colours will remove variants containing ${removedStock} stock units. Do you want to continue?`
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

      // Prepare updated product data
      const productPayload = {
        ...editForm,
        stock: totalStock,

        // Send original product version
        expectedVersion: originalVersion
      };

      // Convert arrays into JSON strings
      Object.entries(productPayload).forEach(
        ([key, value]) => {
          if (Array.isArray(value)) {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, value);
          }
        }
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

      const data = await response.json().catch(() => ({}));

      // Handle concurrent inventory update
      if (response.status === 409) {
        setVersionConflict(true);

        throw new Error(
          data.message ||
          "Product inventory has changed. Please reload the latest product details."
        );
      }

      // Handle other API errors
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
          backgroundColor: "#FFF8F4",
          maxWidth: "800px",
          maxHeight: "90vh",
          overflowY: "auto"
        }}
      >

        {/* Modal Header */}
        <div
          className="d-flex justify-content-between align-items-center rounded-3 p-3 mb-4"
          style={{
            background: "linear-gradient(135deg, #FFF1EB, #FFE2D5)",
            border: "1px solid #F4DCD3",
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-3 p-3 text-white flex-shrink-0"
             style={{
              background: "linear-gradient(180deg, #E65A20, #D93620)",
              boxShadow: "0 4px 10px rgba(217,54,32,0.18)",
            }}
            >
              <i className="bi bi-pencil-square fs-4"></i>
            </div>

            <div>
              <h5
                className="fw-bold mb-1"
                style={{ color: "#2D202E" }}
              >
                Edit Product
              </h5>

              <p className="text-secondary small mb-0">
                Update product details and inventory
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            disabled={updating || reloading}
            aria-label="Close"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleUpdateProduct} className="text-start">

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

          {/* Reusable Size Selector */}
          <div className="mb-3">
            <SizeSelector
              selectedSizes={editForm.sizes}
              onChange={handleSizeChange}
            />
          </div>

          {/* Reusable Colour Selector */}
          <div className="mb-3">
            <ColorSelector
              selectedColors={editForm.colors}
              onChange={handleColorChange}
            />
          </div>

          {/* Existing Product Migration Information */}
          {isLegacyProduct && (
            <div className="alert alert-warning mb-3">

              <h6 className="fw-bold">
                Inventory Upgrade Required
              </h6>

              <p className="small mb-2">
                This product was created before size and
                colour-wise inventory was introduced.
                Please distribute the existing stock among
                the correct size-colour combinations.
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
                  {Math.abs(originalStock - totalStock)}
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
            />
          </div>

          {/* Stock Summary for Variant Products */}
          {!isLegacyProduct && (
            <div
              className="rounded-3 p-3 mb-4"
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #F4DCD3"
              }}
            >
              <h6
                className="fw-bold mb-3"
                style={{ color: "#2D202E" }}
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

                <strong style={{ color: "#D93620" }}>
                  {totalStock}
                </strong>
              </div>

              <hr style={{ borderColor: "#F4DCD3" }} />

              <div className="d-flex justify-content-between">
                <span className="fw-semibold">Stock Change:</span>

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

          {/* Error Message Near Save Button */}
          {error && (
            <div className="alert alert-danger">
              {error}
            </div>
          )}

          {/* Product Version Conflict Warning */}
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
                To prevent incorrect inventory updates,
                saving has been disabled. Please reload
                the latest product information before
                making further changes.
              </p>

              {/* NEW: Reload product without page refresh */}
              <button
                type="button"
                className="btn btn-sm btn-outline-dark"
                onClick={handleReloadProduct}
                disabled={updating || reloading}
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
                color: "#D93620",
                border: "1px solid #D93620",
              }}
              onClick={onClose}
              disabled={updating || reloading}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn text-white fw-semibold rounded-3 px-4 py-2"
              style={{
                background: "linear-gradient(180deg, #E65A20, #D93620)",
                border: "none",
                boxShadow: "0 4px 10px rgba(217,54,32,0.18)",
              }}
              disabled={
                updating ||
                reloading ||
                versionConflict ||
                originalVersion === null
              }
            >
              <i className="bi bi-check-circle me-2"></i>

              {updating
                ? "Saving..."
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