
import { useState } from "react";
import SizeSelector from "./SizeSelector";
import ColorSelector from "./ColorSelector";
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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Handle normal form fields
  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "category" ? { subCategory: "" } : {})
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
    setFormData((prev) => ({
      ...prev,
      colors: updatedColors,
      variants: generateVariants(
        prev.sizes,
        updatedColors,
        prev.variants
      )
    }));
  }

  // Update individual variant stock
  function handleVariantChange(updatedVariants) {
    setFormData((prev) => ({
      ...prev,
      variants: updatedVariants
    }));
  }

  // Handle product images
  function handleImageChange(event) {
    const selectedImages = Array.from(event.target.files);

    if (selectedImages.length > 5) {
      setMessage("You can upload a maximum of 5 images.");
      setImages([]);
      event.target.value = "";
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (
      selectedImages.some(
        (file) => !allowedTypes.includes(file.type)
      )
    ) {
      setMessage("Only JPG, PNG and WEBP images are allowed.");
      setImages([]);
      event.target.value = "";
      return;
    }

    if (
      selectedImages.some(
        (file) => file.size > 5 * 1024 * 1024
      )
    ) {
      setMessage("Each image must be smaller than 5 MB.");
      setImages([]);
      event.target.value = "";
      return;
    }

    setImages(selectedImages);
    setMessage("");
  }

  // Submit product
  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    setMessage("");

    // Validate images
    if (images.length === 0) {
      setMessage("Please upload at least one product image.");
      return;
    }

    // Validate original price
    if (
      !Number.isFinite(Number(formData.price)) ||
      Number(formData.price) <= 0
    ) {
      setMessage("Please enter a valid product price.");
      return;
    }

    // Validate discount price
    if (
      formData.discountPrice !== "" &&
      (
        !Number.isFinite(Number(formData.discountPrice)) ||
        Number(formData.discountPrice) < 0 ||
        Number(formData.discountPrice) > Number(formData.price)
      )
    ) {
      setMessage(
        "Discount price must be between zero and the original price."
      );
      return;
    }

    // Validate selected sizes and colours
    if (!formData.sizes.length || !formData.colors.length) {
      setMessage("Please select at least one size and one colour.");
      return;
    }

    // Validate variant availability
    if (!formData.variants.length) {
      setMessage("Please configure product variant inventory.");
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
    const totalStock = calculateTotalStock(formData.variants);

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

    Object.entries(productPayload).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        productData.append(key, JSON.stringify(value));
      } else {
        productData.append(key, value);
      }
    });

    // Append product images
    images.forEach((image) => {
      productData.append("images", image);
    });

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

      setImages([]);

      const fileInput = document.getElementById("productImages");

      if (fileInput) {
        fileInput.value = "";
      }

      onProductAdded?.(data.product || data);

    } catch (error) {
      setMessage(error.message);
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
        background: "linear-gradient(180deg, #E65A20, #D93620)"
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
        Enter your product details, configure variant
        inventory and upload product images.
      </p>
    </div>
  </div>
</div>

        <form onSubmit={handleSubmit} className="text-start">
          <div className="row g-3">

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
                <option value="men">Men</option>
                <option value="women">Women</option>
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
                  <option key={item} value={item}>
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

            {/* Product Images */}
            <div className="col-12">
              <label className="form-label fw-semibold">
                Product Images * (Maximum 5)
              </label>

              <input
                id="productImages"
                type="file"
                className="form-control rounded-3 py-2"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleImageChange}
              />

              <small className="text-secondary">
                JPG, PNG or WEBP. Maximum 5 MB per image.
              </small>

              {/* Image Preview */}
              {images.length > 0 && (
                <div className="mt-3 d-flex flex-wrap gap-3">
                  {images.map((image, index) => (
                    <div key={`${image.name}-${index}`}>

                      <img
                        src={URL.createObjectURL(image)}
                        alt={image.name}
                        width="90"
                        height="90"
                        className="rounded border"
                        style={{ objectFit: "cover" }}
                        onLoad={(event) =>
                          URL.revokeObjectURL(
                            event.currentTarget.src
                          )
                        }
                      />

                      <small
                        className="d-block text-truncate"
                        style={{ maxWidth: "90px" }}
                      >
                        {image.name}
                      </small>

                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Status Message */}
          {message && (
            <div className="alert alert-info mt-3 mb-0">
              {message}
            </div>
          )}

          {/* Form Buttons */}
          <div className="d-flex gap-2 mt-4">

            <button
              type="submit"
              className="btn text-white fw-semibold rounded-3 px-4 py-2"
              style={{
                background: "linear-gradient(180deg, #E65A20, #D93620)",
                border: "none",
                boxShadow: "0 4px 10px rgba(217, 54, 32, 0.18)"
              }}
              disabled={loading}
            >
              <i className="bi bi-check-circle me-2"></i>

              {loading ? "Saving..." : "Save Product"}
            </button>

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
                disabled={loading}
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
