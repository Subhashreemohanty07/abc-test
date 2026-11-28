import { useState } from "react";
import SizeSelector from "./SizeSelector";
import ColorSelector from "./ColorSelector";
import ProductImageUploader from "./ProductImageUploader";

import VariantStockManager, {
  generateVariants,
  calculateTotalStock
} from "./VariantStockManager";

const API_URL = `${import.meta.env.VITE_API_URL}/api/products`;

function AddProduct({ onProductAdded, onCancel }) {

  const [formData, setFormData] = useState({
    productName: "",
    description: "",
    category: "women",
    subCategory: "",
    brand: "",
    price: "",
    discountPrice: "",
    sizes: [],
    colors: [],
    variants: []
  });

  const [images, setImages] = useState([]);
  const [compressing, setCompressing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Handle normal form fields
  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "category"
        ? { subCategory: "" }
        : {})
    }));
  }

  // Update selected sizes and generate variants
  function handleSizeChange(updatedSizes) {
    setFormData((prev) => ({
      ...prev,
      sizes: updatedSizes,
      variants: generateVariants(
        updatedSizes,
        prev.colors,
        prev.variants
      )
    }));
  }

  // Update selected colours and generate variants
  function handleColorChange(updatedColors) {

    if (compressing || loading) return;

    setFormData((prev) => ({
      ...prev,
      colors: updatedColors,
      variants: generateVariants(
        prev.sizes,
        updatedColors,
        prev.variants
      )
    }));

    // Remove images belonging to deselected colours
    setImages((prev) =>
      prev.filter((image) =>
        updatedColors.includes(image.color)
      )
    );
  }

  // Update individual variant stock
  function handleVariantChange(updatedVariants) {
    setFormData((prev) => ({
      ...prev,
      variants: updatedVariants
    }));
  }

  // Submit product
  async function handleSubmit(event) {

    event.preventDefault();

    if (loading || compressing) return;

    setMessage("");

    // Validate selected colours
    if (!formData.colors.length) {
      setMessage("Please select at least one colour.");
      return;
    }

    // Validate images for every selected colour
    for (const color of formData.colors) {

      const colorImages = images.filter(
        (image) => image.color === color
      );

      if (colorImages.length === 0) {
        setMessage(
          `Please upload at least one image for ${color}.`
        );
        return;
      }

      if (colorImages.length > 5) {
        setMessage(
          `Maximum 5 images allowed for ${color}.`
        );
        return;
      }
    }

    // Validate maximum images per product
    if (images.length > 30) {
      setMessage(
        "Maximum 30 images allowed per product."
      );
      return;
    }

    // Validate image files and colours
    if (
      images.some(
        (image) =>
          !image.file ||
          !formData.colors.includes(image.color)
      )
    ) {
      setMessage(
        "Invalid product image. Please select the image again."
      );
      return;
    }

    // Calculate total compressed image size
    const totalImageSize = images.reduce(
      (total, image) => total + image.file.size,
      0
    );

    // Temporary upload limit for Vercel
    const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;

    if (totalImageSize > MAX_UPLOAD_SIZE) {
      setMessage(
        "Total image upload size exceeds 4 MB. Please reduce the number or size of images."
      );
      return;
    }

    // Validate original price
    if (
      !Number.isFinite(Number(formData.price)) ||
      Number(formData.price) <= 0
    ) {
      setMessage(
        "Please enter a valid product price."
      );
      return;
    }

    // Validate discount price
    if (
      formData.discountPrice !== "" &&
      (
        !Number.isFinite(
          Number(formData.discountPrice)
        ) ||
        Number(formData.discountPrice) < 0 ||
        Number(formData.discountPrice) >
          Number(formData.price)
      )
    ) {
      setMessage(
        "Discount price must be between zero and the original price."
      );
      return;
    }

    // Validate selected sizes and colours
    if (
      !formData.sizes.length ||
      !formData.colors.length
    ) {
      setMessage(
        "Please select at least one size and one colour."
      );
      return;
    }

    // Validate variant availability
    if (!formData.variants.length) {
      setMessage(
        "Please configure product variant inventory."
      );
      return;
    }

    // Validate every variant stock
    const invalidVariant = formData.variants.some(
      (variant) =>
        variant.stock === "" ||
        !Number.isSafeInteger(variant.stock) ||
        variant.stock < 0
    );

    if (invalidVariant) {
      setMessage(
        "Please enter a valid whole-number stock for every variant."
      );
      return;
    }

    // Calculate total product stock
    const totalStock = calculateTotalStock(
      formData.variants
    );

    if (!Number.isSafeInteger(totalStock)) {
      setMessage("Invalid total stock quantity.");
      return;
    }

    // Get authentication token
    const token = localStorage.getItem("token");

    if (!token) {
      setMessage("Please sign in again.");
      return;
    }

    // Prepare product data
    const productData = new FormData();

    const productPayload = {
      ...formData,
      stock: totalStock
    };

    // Append product details
    Object.entries(productPayload).forEach(
      ([key, value]) => {
        if (Array.isArray(value)) {
          productData.append(
            key,
            JSON.stringify(value)
          );
        } else {
          productData.append(key, value);
        }
      }
    );

    // Prepare colour-wise image metadata
    const imageMetadata = [];

    formData.colors.forEach((color) => {

      const colorImages = images.filter(
        (image) => image.color === color
      );

      colorImages.forEach((image, index) => {

        // Append compressed image file
        productData.append(
          "images",
          image.file
        );

        // Append matching colour information
        imageMetadata.push({
          color: color,
          isPrimary: index === 0,
          sortOrder: index
        });

      });
    });

    // Send image metadata to backend
    productData.append(
      "imageMetadata",
      JSON.stringify(imageMetadata)
    );

    try {

      setLoading(true);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: productData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to add product."
        );
      }

      setMessage("Product added successfully!");

      // Reset form after successful submission
      setFormData({
        productName: "",
        description: "",
        category: "women",
        subCategory: "",
        brand: "",
        price: "",
        discountPrice: "",
        sizes: [],
        colors: [],
        variants: []
      });

      // Reset uploaded images
      setImages([]);

      onProductAdded?.(data.product || data);

    } catch (error) {

      setMessage(
        error.message || "Unable to add product."
      );

    } finally {

      setLoading(false);

    }
  }

  return (
    <div
      className="card border-0 shadow-sm rounded-4 overflow-hidden"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #F4DCD3"
      }}
    >

      <div className="card-body p-3 p-md-4">

        {/* Page Header */}
        <div
          className="rounded-4 p-3 p-md-4 mb-4 text-start"
          style={{
            backgroundColor: "#FFF1EB",
            border: "1px solid #F4DCD3"
          }}
        >

          <div className="d-flex align-items-center gap-3">

            <div
              className="rounded-3 p-3 text-white flex-shrink-0"
              style={{
                background:
                  "linear-gradient(180deg, #E65A20, #D93620)"
              }}
            >
              <i className="bi bi-plus-circle fs-4"></i>
            </div>

            <div>

              <h4
                className="fw-bold mb-1"
                style={{ color: "#2D202E" }}
              >
                Add New Product
              </h4>

              <p className="text-secondary small mb-0">
                Enter your product details, configure
                variant inventory and upload
                colour-wise product images.
              </p>

            </div>

          </div>

        </div>

        {/* Product Form */}
        <form
          onSubmit={handleSubmit}
          className="text-start"
        >

          <fieldset
            disabled={loading || compressing}
            className="row g-3"
          >

            {/* Product Name */}
            <div className="col-md-6">

              <label className="form-label fw-semibold">
                Product Name *
              </label>

              <input
                type="text"
                name="productName"
                className="form-control rounded-3 py-2"
                value={formData.productName}
                onChange={handleChange}
                required
              />

            </div>

            {/* Brand */}
            <div className="col-md-6">

              <label className="form-label fw-semibold">
                Brand *
              </label>

              <input
                type="text"
                name="brand"
                className="form-control rounded-3 py-2"
                value={formData.brand}
                onChange={handleChange}
                required
              />

            </div>

            {/* Description */}
            <div className="col-12">

              <label className="form-label fw-semibold">
                Description *
              </label>

              <textarea
                name="description"
                className="form-control rounded-3 py-2"
                rows="3"
                value={formData.description}
                onChange={handleChange}
                required
              />

            </div>

            {/* Category */}
            <div className="col-md-6">

              <label className="form-label fw-semibold">
                Category *
              </label>

              <select
                name="category"
                className="form-select rounded-3 py-2"
                value={formData.category}
                onChange={handleChange}
              >

                <option value="men">
                  Men
                </option>

                <option value="women">
                  Women
                </option>

              </select>

            </div>

            {/* Subcategory */}
            <div className="col-md-6">

              <label className="form-label fw-semibold">
                Subcategory *
              </label>

              <select
                name="subCategory"
                className="form-select rounded-3 py-2"
                value={formData.subCategory}
                onChange={handleChange}
                required
              >

                <option value="">
                  Select subcategory
                </option>

                {(
                  formData.category === "men"
                    ? [
                        "T-Shirts",
                        "Shirts",
                        "Jeans",
                        "Trousers",
                        "Jackets",
                        "Ethnic Wear"
                      ]
                    : [
                        "Tops",
                        "Dresses",
                        "Jeans",
                        "Kurtis",
                        "Sarees",
                        "Ethnic Wear"
                      ]
                ).map((item) => (

                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>

                ))}

              </select>

            </div>

            {/* Original Price */}
            <div className="col-md-6">

              <label className="form-label fw-semibold">
                Original Price (₹) *
              </label>

              <input
                type="number"
                name="price"
                className="form-control rounded-3 py-2"
                min="1"
                step="0.01"
                value={formData.price}
                onChange={handleChange}
                required
              />

            </div>

            {/* Discount Price */}
            <div className="col-md-6">

              <label className="form-label fw-semibold">
                Discount Price (₹)
              </label>

              <input
                type="number"
                name="discountPrice"
                className="form-control rounded-3 py-2"
                min="0"
                step="0.01"
                value={formData.discountPrice}
                onChange={handleChange}
              />

            </div>

            {/* Reusable Size Selector */}
            <SizeSelector
              selectedSizes={formData.sizes}
              onChange={handleSizeChange}
            />

            {/* Reusable Colour Selector */}
            <ColorSelector
              selectedColors={formData.colors}
              onChange={handleColorChange}
            />

            {/* Size and Colour-wise Inventory */}
            <VariantStockManager
              variants={formData.variants}
              onChange={handleVariantChange}
            />

            {/* Colour-wise Product Images */}
            <ProductImageUploader
              selectedColors={formData.colors}
              images={images}
              onChange={setImages}
              processing={compressing}
              onProcessingChange={setCompressing}
              disabled={loading || compressing}
            />

          </fieldset>

          {/* Status Message */}
          {message && (
            <div
              className={`alert mt-3 mb-0 ${
                message === "Product added successfully!"
                  ? "alert-success"
                  : "alert-danger"
              }`}
            >
              {message}
            </div>
          )}

          {/* Form Buttons */}
          <div className="d-flex flex-wrap gap-2 mt-4">

            {/* Save Product Button */}
            <button
              type="submit"
              className="btn text-white fw-semibold rounded-3 px-4 py-2"
              style={{
                background:
                  "linear-gradient(180deg, #E65A20, #D93620)",
                border: "none",
                boxShadow:
                  "0 4px 10px rgba(217, 54, 32, 0.18)"
              }}
              disabled={loading || compressing}
            >

              {loading || compressing ? (

                <span className="spinner-border spinner-border-sm me-2" />

              ) : (

                <i className="bi bi-check-circle me-2"></i>

              )}

              {compressing
                ? "Compressing Images..."
                : loading
                  ? "Saving..."
                  : "Save Product"}

            </button>

            {/* Cancel Button */}
            {onCancel && (

              <button
                type="button"
                className="btn rounded-3 px-4 py-2"
                style={{
                  backgroundColor: "#FFFFFF",
                  color: "#D93620",
                  border: "1px solid #D93620"
                }}
                onClick={onCancel}
                disabled={loading || compressing}
              >
                Cancel
              </button>

            )}

          </div>

        </form>

      </div>

    </div>
  );
}

export default AddProduct;