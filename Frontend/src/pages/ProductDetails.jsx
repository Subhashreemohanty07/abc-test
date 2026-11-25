
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { COLOR_OPTIONS } from "../constants/productOptions";

const API_URL = import.meta.env.VITE_API_URL;

// Convert existing sizes and colours into arrays
function normalizeOptions(value) {
  return [
    ...new Set(
      (Array.isArray(value) ? value : String(value || "").split(","))
        .map((item) => String(item).trim())
        .filter(Boolean)
    )
  ];
}

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  // Fetch product details
  useEffect(() => {
    const controller = new AbortController();

    async function fetchProduct() {
      try {
        setLoading(true);
        setError("");
        setQuantity(1);

        const response = await fetch(
          `${API_URL}/api/products/${id}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Product not found");
        }

        const data = await response.json();
        const productData = data.product || data.data || data;

        setProduct(productData);
        setSelectedImage(productData.images?.[0]?.url || "");

        const sizes = normalizeOptions(productData.sizes);
        const colors = normalizeOptions(productData.colors);

        const variants = Array.isArray(productData.variants)
          ? productData.variants
          : [];

        // Automatically select the first available variant
        const firstAvailableVariant = variants.find(
          (variant) => Number(variant.stock) > 0
        );

        if (firstAvailableVariant) {
          setSelectedSize(firstAvailableVariant.size);
          setSelectedColor(firstAvailableVariant.color);
        } else {
          setSelectedSize(sizes[0] || "");
          setSelectedColor(colors[0] || "");
        }

      } catch (err) {
        if (err.name === "AbortError") return;

        console.error(err);
        setError("Unable to load product details.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchProduct();

    return () => controller.abort();
  }, [id]);

  // Product sizes and colours
  const sizes = normalizeOptions(product?.sizes);
  const colors = normalizeOptions(product?.colors);

  // Product variants
  const variants = Array.isArray(product?.variants)
    ? product.variants
    : [];

  const hasVariants = variants.length > 0;

  // Find currently selected variant
  const selectedVariant = variants.find(
    (variant) =>
      variant.size === selectedSize &&
      variant.color === selectedColor
  );

  // Get stock for a particular size-colour combination
  const getVariantStock = (size, color) => {
    // Backward compatibility for old products
    if (!hasVariants) {
      return Number(product?.stock || 0);
    }

    const variant = variants.find(
      (item) =>
        item.size === size &&
        item.color === color
    );

    return Number(variant?.stock || 0);
  };

  // Stock of currently selected combination
  const availableStock = hasVariants
    ? Number(selectedVariant?.stock || 0)
    : Number(product?.stock || 0);

  const isOutOfStock = availableStock <= 0;

  // Check whether a colour has any available sizes
  const isColorAvailable = (color) => {
    if (!hasVariants) {
      return Number(product?.stock || 0) > 0;
    }

    return variants.some(
      (variant) =>
        variant.color === color &&
        Number(variant.stock) > 0
    );
  };

  // Get colour hex code
  const getColorHex = (colorName) => {
    const matchedColor = COLOR_OPTIONS.find(
      (color) =>
        color.name.toLowerCase() ===
        String(colorName).toLowerCase()
    );

    return matchedColor?.hex || "#E9ECEF";
  };

  // Handle size selection
  const handleSizeChange = (size) => {
    const stock = getVariantStock(size, selectedColor);

    if (stock <= 0) return;

    setSelectedSize(size);
    setQuantity(1);
  };

  // Handle colour selection
  const handleColorChange = (color) => {
    if (!isColorAvailable(color)) return;

    setSelectedColor(color);
    setQuantity(1);

    if (hasVariants) {
      const currentSizeStock = getVariantStock(
        selectedSize,
        color
      );

      // Keep selected size if available in the new colour
      if (currentSizeStock > 0) {
        return;
      }

      // Otherwise select the first available size
      const firstAvailableSize = sizes.find(
        (size) => getVariantStock(size, color) > 0
      );

      setSelectedSize(firstAvailableSize || "");
    }
  };

  // Product pricing
  const price = Number(product?.price || 0);

  const discountedPrice = Number(
    product?.discountPrice || product?.price || 0
  );

  const discount =
    price > discountedPrice
      ? Math.round(((price - discountedPrice) / price) * 100)
      : 0;

  const images = product?.images || [];

  // Add selected product variant to cart
  const handleAddToBag = async () => {
    if (!product || addingToCart) return;

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/signin", {
        state: { from: `/products/${id}` },
      });
      return;
    }

    // Validate selected size
    if (sizes.length && !sizes.includes(selectedSize)) {
      alert("Please select a size.");
      return;
    }

    // Validate selected colour
    if (colors.length && !colors.includes(selectedColor)) {
      alert("Please select a colour.");
      return;
    }

    // Validate selected variant
    if (hasVariants && !selectedVariant) {
      alert("Please select an available size and colour.");
      return;
    }

    // Validate requested quantity
    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      availableStock <= 0 ||
      quantity > availableStock
    ) {
      alert("Requested quantity is not available.");
      return;
    }

    try {
      setAddingToCart(true);

      const response = await fetch(`${API_URL}/api/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: product._id,
          quantity: quantity,
          size: selectedSize,
          color: selectedColor,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        navigate("/signin", {
          state: { from: `/products/${id}` },
        });
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to add product to cart."
        );
      }

      window.dispatchEvent(new Event("cartUpdated"));

      navigate("/cart");

    } catch (error) {
      console.error("Add to cart error:", error);
      alert(error.message || "Something went wrong.");
    } finally {
      setAddingToCart(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <>
        <Navbar />

        <div className="container text-center py-5">
          <div className="spinner-border text-danger"></div>
          <p className="mt-3">Loading product...</p>
        </div>

        <Footer showSocial={false} />
      </>
    );
  }

  // Error state
  if (error || !product) {
    return (
      <>
        <Navbar />

        <div className="container text-center py-5">
          <i className="bi bi-bag-x display-1 text-secondary"></i>

          <h4 className="mt-3">Product not found</h4>

          <p className="text-secondary">{error}</p>

          <Link to="/products" className="btn btn-dark">
            Continue Shopping
          </Link>
        </div>

        <Footer showSocial={false} />
      </>
    );
  }

  return (
    <div className="bg-white min-vh-100">

      <Navbar />

      <main
        className="container pb-4"
        style={{ paddingTop: "150px" }}
      >

        {/* BREADCRUMB */}
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb small">

            <li className="breadcrumb-item">
              <Link
                to="/"
                className="text-secondary text-decoration-none"
              >
                Home
              </Link>
            </li>

            <li className="breadcrumb-item">
              <Link
                to="/products"
                className="text-secondary text-decoration-none"
              >
                Clothing
              </Link>
            </li>

            <li className="breadcrumb-item active">
              {product.productName}
            </li>

          </ol>
        </nav>

        <div className="row g-4 g-lg-5 align-items-start">

          {/* PRODUCT IMAGES */}
          <div className="col-lg-6">
            <div className="row g-3">

              {/* DESKTOP THUMBNAILS */}
              {images.length > 1 && (
                <div className="col-2 d-none d-md-block">

                  <div className="d-flex flex-column gap-3">

                    {images.map((image, index) => (
                      <button
                        type="button"
                        key={image.publicId || index}
                        className="btn p-1"
                        style={{
                          border:
                            selectedImage === image.url
                              ? "2px solid #c2185b"
                              : "1px solid #ddd",
                        }}
                        onClick={() =>
                          setSelectedImage(image.url)
                        }
                      >
                        <img
                          src={image.url}
                          alt="Product"
                          className="img-fluid"
                        />
                      </button>
                    ))}

                  </div>
                </div>
              )}

              {/* MAIN PRODUCT IMAGE */}
              <div
                className={
                  images.length > 1
                    ? "col-12 col-md-10"
                    : "col-12"
                }
              >
                <div className="position-relative bg-light rounded overflow-hidden d-flex justify-content-center align-items-center">

                  <img
                    src={
                      selectedImage ||
                      "https://placehold.co/600x750?text=No+Image"
                    }
                    alt={product.productName}
                    className="img-fluid w-100"
                    style={{
                      height: "min(65vh, 520px)",
                      objectFit: "contain",
                    }}
                  />

                  {discount > 0 && (
                    <span className="badge bg-danger position-absolute top-0 start-0 m-3 p-2">
                      {discount}% OFF
                    </span>
                  )}

                </div>
              </div>

              {/* MOBILE THUMBNAILS */}
              {images.length > 1 && (
                <div className="col-12 d-md-none">

                  <div className="d-flex gap-2 overflow-auto">

                    {images.map((image, index) => (
                      <button
                        type="button"
                        key={image.publicId || index}
                        className="btn p-1 flex-shrink-0"
                        style={{
                          width: "75px",
                          border:
                            selectedImage === image.url
                              ? "2px solid #c2185b"
                              : "1px solid #ddd",
                        }}
                        onClick={() =>
                          setSelectedImage(image.url)
                        }
                      >
                        <img
                          src={image.url}
                          alt="Product"
                          className="img-fluid"
                        />
                      </button>
                    ))}

                  </div>
                </div>
              )}

            </div>
          </div>

          {/* PRODUCT INFORMATION */}
          <div className="col-lg-6">
            <div className="ps-lg-4 text-start">

              {/* BRAND */}
              <p className="text-secondary fw-semibold mb-2">
                {product.brand || "NYKAA STORE"}
              </p>

              {/* PRODUCT NAME */}
              <h3 className="fw-bold mb-3">
                {product.productName}
              </h3>

              {/* DESCRIPTION */}
              <p className="text-secondary">
                {product.description}
              </p>

              {/* PRICE */}
              <div className="d-flex align-items-center gap-3 flex-wrap my-4">

                <h4 className="fw-bold mb-0">
                  ₹{discountedPrice.toLocaleString("en-IN")}
                </h4>

                {discount > 0 && (
                  <>
                    <del className="text-secondary">
                      ₹{price.toLocaleString("en-IN")}
                    </del>

                    <span className="text-danger fw-semibold">
                      {discount}% OFF
                    </span>
                  </>
                )}

              </div>

              <p className="text-secondary small">
                Inclusive of all taxes
              </p>

              {/* COLOUR SELECTION */}
              {colors.length > 0 && (
                <div className="my-4">

                  <h6 className="fw-bold mb-3">
                    Select Colour:{" "}
                    <span className="text-secondary">
                      {selectedColor}
                    </span>
                  </h6>

                  <div className="d-flex flex-wrap gap-3">

                    {colors.map((color) => {
                      const available = isColorAvailable(color);
                      const selected = selectedColor === color;

                      return (
                        <button
                          type="button"
                          key={color}
                          disabled={!available || addingToCart}
                          aria-pressed={selected}
                          title={
                            available
                              ? color
                              : `${color} - Out of stock`
                          }
                          className="btn d-flex flex-column align-items-center gap-2 p-2"
                          style={{
                            minWidth: "75px",
                            border: selected
                              ? "2px solid #fc2779"
                              : "1px solid #ddd",
                            backgroundColor: selected
                              ? "#fff0f5"
                              : "#fff",
                            opacity: available ? 1 : 0.45,
                            cursor: available
                              ? "pointer"
                              : "not-allowed",
                            borderRadius: "10px",
                          }}
                          onClick={() =>
                            handleColorChange(color)
                          }
                        >

                          {/* COLOUR SWATCH */}
                          <span
                            className="rounded-circle position-relative"
                            style={{
                              width: "35px",
                              height: "35px",
                              background: getColorHex(color),
                              border: "1px solid #ccc",
                            }}
                          >
                            {!available && (
                              <span
                                style={{
                                  position: "absolute",
                                  top: "50%",
                                  left: "0",
                                  width: "100%",
                                  height: "2px",
                                  backgroundColor: "#dc3545",
                                  transform: "rotate(-45deg)",
                                }}
                              />
                            )}
                          </span>

                          {/* COLOUR NAME */}
                          <small
                            style={{
                              fontSize: "12px",
                              fontWeight: selected ? 600 : 400,
                              textDecoration: available
                                ? "none"
                                : "line-through",
                            }}
                          >
                            {color}
                          </small>

                        </button>
                      );
                    })}

                  </div>
                </div>
              )}

              {/* SIZE SELECTION */}
              {sizes.length > 0 && (
                <div className="my-4">

                  <h6 className="fw-bold mb-3">
                    Select Size:{" "}
                    <span className="text-secondary">
                      {selectedSize || "Not selected"}
                    </span>
                  </h6>

                  <div className="d-flex flex-wrap gap-2">

                    {sizes.map((size) => {
                      const stock = getVariantStock(
                        size,
                        selectedColor
                      );

                      const available = stock > 0;
                      const selected = selectedSize === size;

                      return (
                        <button
                          type="button"
                          key={size}
                          disabled={!available || addingToCart}
                          aria-pressed={selected}
                          title={
                            available
                              ? `${stock} items available`
                              : "Out of stock"
                          }
                          className="btn"
                          style={{
                            minWidth: "48px",
                            minHeight: "45px",
                            borderRadius: "8px",
                            border:
                              selected && available
                                ? "2px solid #fc2779"
                                : "1px solid #ccc",
                            backgroundColor:
                              selected && available
                                ? "#fc2779"
                                : "#fff",
                            color:
                              selected && available
                                ? "#fff"
                                : available
                                  ? "#212529"
                                  : "#999",
                            textDecoration: available
                              ? "none"
                              : "line-through",
                            opacity: available ? 1 : 0.55,
                          }}
                          onClick={() =>
                            handleSizeChange(size)
                          }
                        >
                          {size}
                        </button>
                      );
                    })}

                  </div>

                  <small className="text-secondary d-block mt-2">
                    Crossed-out sizes are currently unavailable.
                  </small>

                </div>
              )}

              {/* SELECTED VARIANT SUMMARY */}
              {hasVariants && selectedSize && selectedColor && (
                <div
                  className="rounded p-3 my-3"
                  style={{
                    backgroundColor: "#fff0f5",
                    border: "1px solid #f8bbd0",
                  }}
                >

                  <div className="small fw-semibold mb-1">
                    Selected Variant
                  </div>

                  <div className="d-flex align-items-center gap-2">

                    <span
                      className="rounded-circle"
                      style={{
                        width: "20px",
                        height: "20px",
                        background: getColorHex(selectedColor),
                        border: "1px solid #ccc",
                      }}
                    />

                    <span>
                      {selectedColor} / Size {selectedSize}
                    </span>

                  </div>

                </div>
              )}

              {/* QUANTITY */}
              <div className="my-4">

                <h6 className="fw-bold mb-3">
                  Quantity
                </h6>

                <div
                  className="d-flex align-items-center border rounded"
                  style={{ width: "140px" }}
                >

                  <button
                    className="btn btn-light rounded-0"
                    type="button"
                    disabled={
                      quantity <= 1 ||
                      isOutOfStock ||
                      addingToCart
                    }
                    onClick={() =>
                      setQuantity((q) => Math.max(1, q - 1))
                    }
                  >
                    −
                  </button>

                  <span className="flex-grow-1 text-center">
                    {isOutOfStock ? 0 : quantity}
                  </span>

                  <button
                    className="btn btn-light rounded-0"
                    type="button"
                    disabled={
                      isOutOfStock ||
                      quantity >= availableStock ||
                      addingToCart
                    }
                    onClick={() =>
                      setQuantity((q) =>
                        Math.min(availableStock, q + 1)
                      )
                    }
                  >
                    +
                  </button>

                </div>

              </div>

              {/* VARIANT STOCK */}
              <div className="mb-3">

                {availableStock > 0 ? (
                  <p
                    className={`small fw-semibold mb-0 ${
                      availableStock <= 5
                        ? "text-danger"
                        : "text-success"
                    }`}
                  >

                    <i
                      className={`bi ${
                        availableStock <= 5
                          ? "bi-exclamation-circle"
                          : "bi-check-circle"
                      } me-2`}
                    />

                    {availableStock <= 5
                      ? `Hurry! Only ${availableStock} left in stock`
                      : `${availableStock} items available`}

                  </p>
                ) : (
                  <p className="small fw-semibold text-danger mb-0">

                    <i className="bi bi-x-circle me-2"></i>

                    {hasVariants
                      ? "Selected combination is out of stock"
                      : "Out of stock"}

                  </p>
                )}

              </div>

              {/* ACTION BUTTONS */}
              <div className="d-grid gap-3 mt-4">

                <button
                  type="button"
                  className="btn btn-lg text-white"
                  style={{
                    backgroundColor: isOutOfStock
                      ? "#999"
                      : "#fc2779",
                  }}
                  onClick={handleAddToBag}
                  disabled={isOutOfStock || addingToCart}
                >

                  <i className="bi bi-bag me-2"></i>

                  {addingToCart
                    ? "ADDING..."
                    : isOutOfStock
                      ? "OUT OF STOCK"
                      : "ADD TO BAG"}

                </button>

                <button
                  type="button"
                  className="btn btn-outline-dark btn-lg"
                  onClick={handleAddToBag}
                  disabled={isOutOfStock || addingToCart}
                >
                  BUY NOW
                </button>

              </div>

              {/* DELIVERY INFORMATION */}
              <div className="mt-4">

                <div className="d-flex gap-3 align-items-center border-bottom py-3">

                  <i className="bi bi-truck fs-4"></i>

                  <div>
                    <h6 className="fw-semibold mb-1">
                      Delivery Information
                    </h6>

                    <p className="small text-secondary mb-0">
                      Delivery details will be available at checkout.
                    </p>
                  </div>

                </div>

                <div className="d-flex gap-3 align-items-center border-bottom py-3">

                  <i className="bi bi-arrow-repeat fs-4"></i>

                  <div>
                    <h6 className="fw-semibold mb-1">
                      Return & Exchange
                    </h6>

                    <p className="small text-secondary mb-0">
                      Please check the return policy before ordering.
                    </p>
                  </div>

                </div>

                <div className="d-flex gap-3 align-items-center py-3">

                  <i className="bi bi-shield-check fs-4"></i>

                  <div>
                    <h6 className="fw-semibold mb-1">
                      Product Information
                    </h6>

                    <p className="small text-secondary mb-0">
                      Product details are provided by the seller.
                    </p>
                  </div>

                </div>

              </div>

            </div>
          </div>

        </div>

      </main>

      <Footer showSocial={false} />

    </div>
  );
}

export default ProductDetails;
