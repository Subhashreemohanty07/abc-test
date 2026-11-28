import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { COLOR_OPTIONS } from "../constants/productOptions";

const API_URL = import.meta.env.VITE_API_URL;

// Sabkoo customer theme
const THEME = {
  primary: "#07868B",
  primaryDark: "#084F55",
  light: "#EAF7F7",
  border: "#B9DFE0",
  text: "#212529",
  muted: "#6C757D",
  background: "#F8F9FA"
};

// Convert existing sizes and colours into arrays
function normalizeOptions(value) {
  return [
    ...new Set(
      (Array.isArray(value)
        ? value
        : String(value || "").split(",")
      )
        .map((item) => String(item).trim())
        .filter(Boolean)
    )
  ];
}

// Get images belonging to the selected colour
function getColorImages(product, selectedColor) {
  const allImages = Array.isArray(product?.images)
    ? product.images.filter((image) => image?.url)
    : [];

  const normalizeColor = (color) =>
    String(color || "").trim().toLowerCase();

  const matchingImages = allImages.filter(
    (image) =>
      normalizeColor(image.color) ===
      normalizeColor(selectedColor)
  );

  const legacyImages = allImages.filter(
    (image) => !normalizeColor(image.color)
  );

  let filteredImages;

  if (!selectedColor) {
    filteredImages = allImages;
  } else if (matchingImages.length > 0) {
    filteredImages = matchingImages;
  } else {
    // Backward compatibility for older products
    filteredImages = legacyImages;
  }

  // Primary image first, followed by sortOrder
  return [...filteredImages].sort((first, second) => {
    const primaryDifference =
      Number(Boolean(second.isPrimary)) -
      Number(Boolean(first.isPrimary));

    if (primaryDifference !== 0) {
      return primaryDifference;
    }

    return (
      Number(first.sortOrder ?? 0) -
      Number(second.sortOrder ?? 0)
    );
  });
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

  // Responsive desktop layout
  const [isDesktop, setIsDesktop] = useState(
    () => window.innerWidth >= 992
  );

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 992);
    };

    window.addEventListener("resize", handleResize);

    return () =>
      window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch product details
  useEffect(() => {
    const controller = new AbortController();

    async function fetchProduct() {
      try {
        setLoading(true);
        setError("");
        setQuantity(1);
        setSelectedImage("");
        setSelectedColor("");
        setSelectedSize("");

        const response = await fetch(
          `${API_URL}/api/products/${id}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error("Product not found");
        }

        const data = await response.json();

        const productData =
          data.product || data.data || data;

        const sizes = normalizeOptions(productData.sizes);
        const colors = normalizeOptions(productData.colors);

        const variants = Array.isArray(productData.variants)
          ? productData.variants
          : [];

        // Automatically select the first available variant
        const firstAvailableVariant = variants.find(
          (variant) => Number(variant.stock) > 0
        );

        const initialSize =
          firstAvailableVariant?.size ||
          sizes[0] ||
          "";

        const initialColor =
          firstAvailableVariant?.color ||
          colors[0] ||
          "";

        // Load images for the initially selected colour
        const initialImages = getColorImages(
          productData,
          initialColor
        );

        setProduct(productData);
        setSelectedSize(initialSize);
        setSelectedColor(initialColor);

        // Automatically display the primary image
        setSelectedImage(
          initialImages[0]?.url || ""
        );

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
    const stock = getVariantStock(
      size,
      selectedColor
    );

    if (stock <= 0) return;

    setSelectedSize(size);
    setQuantity(1);
  };

  // Handle colour selection
  const handleColorChange = (color) => {
    if (addingToCart) return;

    if (color === selectedColor) return;

    setSelectedColor(color);
    setQuantity(1);

    // Get images belonging to the selected colour
    const colorImages = getColorImages(
      product,
      color
    );

    // Automatically select the new colour's primary image
    setSelectedImage(
      colorImages[0]?.url || ""
    );

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
    product?.discountPrice ?? product?.price ?? 0
  );

  const discount =
    price > discountedPrice
      ? Math.round(
          ((price - discountedPrice) / price) * 100
        )
      : 0;

  // Only display selected colour's images
  const images = getColorImages(
    product,
    selectedColor
  );

  // Ensure main image belongs to selected colour
  const activeImage =
    images.find(
      (image) => image.url === selectedImage
    )?.url ||
    images[0]?.url ||
    "";

  const activeImageIndex = images.findIndex(
    (image) => image.url === activeImage
  );

  // Previous image
  const handlePreviousImage = () => {
    if (images.length <= 1) return;

    const previousIndex =
      (activeImageIndex - 1 + images.length) %
      images.length;

    setSelectedImage(
      images[previousIndex].url
    );
  };

  // Next image
  const handleNextImage = () => {
    if (images.length <= 1) return;

    const nextIndex =
      (activeImageIndex + 1) %
      images.length;

    setSelectedImage(
      images[nextIndex].url
    );
  };

  // Validate selected product before purchase
  const validatePurchase = () => {
    if (!product || addingToCart) return false;

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/signin", {
        state: {
          from: `/products/${id}`
        }
      });

      return false;
    }

    if (sizes.length && !sizes.includes(selectedSize)) {
      alert("Please select a size.");
      return false;
    }

    if (colors.length && !colors.includes(selectedColor)) {
      alert("Please select a colour.");
      return false;
    }

    if (hasVariants && !selectedVariant) {
      alert("Please select an available size and colour.");
      return false;
    }

    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      availableStock <= 0 ||
      quantity > availableStock
    ) {
      alert("Requested quantity is not available.");
      return false;
    }

    return true;
  };


// ADD TO BAG
const handleAddToBag = async () => {
  if (!validatePurchase()) return;

  const token = localStorage.getItem("token");

  try {
    setAddingToCart(true);

    const response = await fetch(
      `${API_URL}/api/cart`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },

        body: JSON.stringify({
          productId: product._id,
          quantity,
          size: selectedSize,
          color: selectedColor
        })
      }
    );

    const data = await response.json();

    if (response.status === 401) {
      navigate("/signin", {
        state: {
          from: `/products/${id}`
        }
      });

      return;
    }

    if (!response.ok) {
      throw new Error(
        data.message || "Failed to add product to cart."
      );
    }

    // Update Navbar cart count
    window.dispatchEvent(new Event("cartUpdated"));

    // Stay on Product Details page

  } catch (error) {
    console.error("Add to cart error:", error);

    alert(
      error.message || "Something went wrong."
    );

  } finally {
    setAddingToCart(false);
  }
};


// BUY NOW
const handleBuyNow = () => {
  if (!validatePurchase()) return;

  const params = new URLSearchParams({
    mode: "buyNow",
    productId: product._id,
    quantity: String(quantity),
    size: selectedSize,
    color: selectedColor
  });

  // Direct checkout without adding to cart
  navigate(`/checkout?${params.toString()}`);
};

  // Loading state
  if (loading) {
    return (
      <>
        <Navbar />

        <div
          className="container text-center py-5"
          style={{ minHeight: "60vh" }}
        >
          <div
            className="spinner-border"
            style={{ color: THEME.primary }}
            role="status"
          />

          <p className="mt-3">
            Loading product...
          </p>
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

        <div
          className="container text-center py-5"
          style={{ minHeight: "60vh" }}
        >
          <i className="bi bi-bag-x display-1 text-secondary"></i>

          <h4 className="mt-3">
            Product not found
          </h4>

          <p className="text-secondary">
            {error}
          </p>

          <Link
            to="/products"
            className="btn text-white"
            style={{
              backgroundColor: THEME.primary
            }}
          >
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
        className="container pb-5"
        style={{
          paddingTop: "24px",
          maxWidth: "1400px"
        }}
      >

        {/* BREADCRUMB */}
        <nav
          aria-label="breadcrumb"
          className="mb-4"
        >
          <ol className="breadcrumb small mb-0">

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

            {product.subCategory &&
              product.subCategory !== product.productName && (
              <li className="breadcrumb-item text-secondary">
                {product.subCategory}
              </li>
            )}

            <li
              className="breadcrumb-item active"
              aria-current="page"
            >
              {product.productName}
            </li>

          </ol>
        </nav>

        <div className="row g-4 g-lg-5 align-items-start">

          {/* ===================================== */}
          {/* PRODUCT IMAGE GALLERY */}
          {/* ===================================== */}

          <div
            className="col-lg-6"
            style={{
              position: isDesktop
                ? "sticky"
                : "static",

              top: isDesktop
                ? "160px"
                : "auto",

              alignSelf: "flex-start"
            }}
          >

            <div className="row g-3">

              {/* DESKTOP THUMBNAILS */}
              {images.length > 1 && (
                <div className="col-2 d-none d-md-block">

                  <div
                    key={selectedColor}
                    className="d-flex flex-column gap-2 pe-1"
                    style={{
                      maxHeight: "min(62vh, 560px)",
                      overflowY: "auto",
                      overflowX: "hidden",
                      scrollbarWidth: "thin",
                      scrollbarColor:
                        `${THEME.border} transparent`
                    }}
                  >

                    {images.map((image, index) => {
                      const selected =
                        activeImage === image.url;

                      return (
                        <button
                          type="button"
                          key={
                            image._id ||
                            image.publicId ||
                            index
                          }
                          aria-label={
                            `View ${selectedColor} image ${index + 1}`
                          }
                          aria-pressed={selected}
                          className="btn p-1 flex-shrink-0 rounded-3 position-relative"
                          style={{
                            width: "100%",
                            aspectRatio: "3 / 4",

                            border: selected
                              ? `2px solid ${THEME.primary}`
                              : "2px solid #E5E7EB",

                            backgroundColor: selected
                              ? THEME.light
                              : "#FFFFFF"
                          }}
                          onClick={() =>
                            setSelectedImage(image.url)
                          }
                        >

                          <img
                            src={image.url}
                            alt={
                              `${product.productName} ${selectedColor} view ${index + 1}`
                            }
                            loading="lazy"
                            className="rounded-2"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block"
                            }}
                          />

                        </button>
                      );
                    })}

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

                <div
                  className="position-relative rounded-4 overflow-hidden d-flex justify-content-center align-items-center"
                  style={{
                    backgroundColor: THEME.background,
                    border: "1px solid #EEEEEE",

                    height: isDesktop
                      ? "min(62vh, 560px)"
                      : "clamp(300px, 110vw, 520px)"
                  }}
                >

                  {activeImage ? (
                    <img
                      src={activeImage}
                      alt={
                        `${product.productName} - ${selectedColor}`
                      }
                      className="w-100 h-100"
                      style={{
                        objectFit: "contain",
                        display: "block"
                      }}
                    />
                  ) : (
                    <div className="text-center text-secondary">

                      <i className="bi bi-image display-4"></i>

                      <p className="mt-2 mb-0">
                        No image available
                      </p>

                    </div>
                  )}

                  {/* DISCOUNT BADGE */}
                  {discount > 0 && (
                    <span
                      className="badge position-absolute top-0 start-0 m-3 px-3 py-2 rounded-2"
                      style={{
                        backgroundColor: "#DC3545"
                      }}
                    >
                      {discount}% OFF
                    </span>
                  )}

                  {/* PREVIOUS AND NEXT BUTTONS */}
                  {images.length > 1 && (
                    <>

                      <button
                        type="button"
                        aria-label="Previous image"
                        className="btn bg-white shadow-sm rounded-circle position-absolute top-50 start-0 translate-middle-y ms-2 d-flex justify-content-center align-items-center"
                        style={{
                          width: "36px",
                          height: "36px",
                          color: THEME.primaryDark
                        }}
                        onClick={handlePreviousImage}
                      >
                        <i className="bi bi-chevron-left"></i>
                      </button>

                      <button
                        type="button"
                        aria-label="Next image"
                        className="btn bg-white shadow-sm rounded-circle position-absolute top-50 end-0 translate-middle-y me-2 d-flex justify-content-center align-items-center"
                        style={{
                          width: "36px",
                          height: "36px",
                          color: THEME.primaryDark
                        }}
                        onClick={handleNextImage}
                      >
                        <i className="bi bi-chevron-right"></i>
                      </button>

                      {/* IMAGE COUNTER */}
                      <span
                        className="position-absolute bottom-0 end-0 m-3 rounded-pill px-3 py-1 small text-white"
                        style={{
                          backgroundColor:
                            "rgba(0,0,0,0.60)"
                        }}
                      >
                        {activeImageIndex + 1} / {images.length}
                      </span>

                    </>
                  )}

                </div>

                {/* SELECTED COLOUR IMAGE INFORMATION */}
                <div className="d-flex justify-content-between align-items-center mt-2 px-1">

                  <small className="text-secondary">
                    {selectedColor
                      ? `${selectedColor} colour`
                      : "Product images"}
                  </small>

                  <small className="text-secondary">
                    {images.length}{" "}
                    {images.length === 1
                      ? "image"
                      : "images"}
                  </small>

                </div>

              </div>

              {/* MOBILE THUMBNAILS */}
              {images.length > 1 && (
                <div className="col-12 d-md-none">

                  <div
                    key={selectedColor}
                    className="d-flex gap-2 overflow-auto pb-2"
                    style={{
                      scrollbarWidth: "thin"
                    }}
                  >

                    {images.map((image, index) => {
                      const selected =
                        activeImage === image.url;

                      return (
                        <button
                          type="button"
                          key={
                            image._id ||
                            image.publicId ||
                            index
                          }
                          aria-label={
                            `View image ${index + 1}`
                          }
                          aria-pressed={selected}
                          className="btn p-1 flex-shrink-0 rounded-3"
                          style={{
                            width: "72px",
                            height: "92px",

                            border: selected
                              ? `2px solid ${THEME.primary}`
                              : "2px solid #E5E7EB",

                            backgroundColor: selected
                              ? THEME.light
                              : "#FFFFFF"
                          }}
                          onClick={() =>
                            setSelectedImage(image.url)
                          }
                        >

                          <img
                            src={image.url}
                            alt={
                              `${product.productName} view ${index + 1}`
                            }
                            loading="lazy"
                            className="rounded-2"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover"
                            }}
                          />

                        </button>
                      );
                    })}

                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ===================================== */}
          {/* PRODUCT INFORMATION */}
          {/* ===================================== */}

          <div className="col-lg-6">

            <div className="ps-lg-3 text-start">

              {/* BRAND */}
              <p
                className="fw-semibold mb-2"
                style={{
                  color: THEME.primary
                }}
              >
                {product.brand || "SABKOO STORE"}
              </p>

              {/* PRODUCT NAME */}
              <h3
                className="fw-bold mb-2"
                style={{
                  color: THEME.text
                }}
              >
                {product.productName}
              </h3>

              {/* DESCRIPTION */}
              <p
                className="text-secondary mb-3"
                style={{
                  lineHeight: "1.6",
                  whiteSpace: "pre-line"
                }}
              >
                {product.description}
              </p>

              {/* PRICE */}
              <div className="d-flex align-items-center gap-3 flex-wrap mt-3 mb-2">

                <h3 className="fw-bold mb-0">
                  ₹{discountedPrice.toLocaleString("en-IN")}
                </h3>

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

              <p
                className="small mb-3"
                style={{
                  color: THEME.primary
                }}
              >
                Inclusive of all taxes
              </p>

              <hr
                style={{
                  borderColor: "#DADADA"
                }}
              />

              {/* ===================================== */}
              {/* COLOUR SELECTION */}
              {/* ===================================== */}

              {colors.length > 0 && (
                <div className="my-4">

                  <h6 className="fw-bold mb-3">

                    Select Colour:{" "}

                    <span
                      style={{
                        color: THEME.primary
                      }}
                    >
                      {selectedColor || "Not selected"}
                    </span>

                  </h6>

                  <div className="d-flex flex-wrap gap-2">

                    {colors.map((color) => {
                      const available =
                        isColorAvailable(color);

                      const selected =
                        selectedColor === color;

                      // Primary image for this colour
                      const colorThumbnail =
                        getColorImages(product, color)[0]?.url;

                      return (
                        <button
                          type="button"
                          key={color}
                          disabled={addingToCart}
                          aria-pressed={selected}
                          title={
                            available
                              ? color
                              : `${color} - Out of stock`
                          }
                          className="btn d-flex flex-column align-items-center gap-2 p-1"
                          style={{
                            width: "78px",

                            border: selected
                              ? `2px solid ${THEME.primary}`
                              : "2px solid #E5E7EB",

                            backgroundColor: selected
                              ? THEME.light
                              : "#FFFFFF",

                            borderRadius: "10px",
                            opacity: available ? 1 : 0.55
                          }}
                          onClick={() =>
                            handleColorChange(color)
                          }
                        >

                          {/* COLOUR IMAGE PREVIEW */}
                          <div
                            className="position-relative rounded-2 overflow-hidden"
                            style={{
                              width: "64px",
                              height: "78px",
                              backgroundColor:
                                THEME.background
                            }}
                          >

                            {colorThumbnail ? (
                              <img
                                src={colorThumbnail}
                                alt={`${color} colour`}
                                loading="lazy"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover"
                                }}
                              />
                            ) : (
                              <div className="w-100 h-100 d-flex align-items-center justify-content-center">

                                <span
                                  className="rounded-circle"
                                  style={{
                                    width: "34px",
                                    height: "34px",
                                    background:
                                      getColorHex(color),

                                    border: "1px solid #CCC"
                                  }}
                                />

                              </div>
                            )}

                            {/* SELECTED CHECKMARK */}
                            {selected && (
                              <span
                                className="position-absolute top-0 end-0 m-1 rounded-circle text-white d-flex align-items-center justify-content-center"
                                style={{
                                  width: "18px",
                                  height: "18px",
                                  backgroundColor:
                                    THEME.primary
                                }}
                              >
                                <i className="bi bi-check"></i>
                              </span>
                            )}

                          </div>

                          {/* COLOUR NAME */}
                          <div className="d-flex align-items-center justify-content-center gap-1">

                            <span
                              className="rounded-circle flex-shrink-0"
                              style={{
                                width: "10px",
                                height: "10px",
                                background:
                                  getColorHex(color),

                                border: "1px solid #CCC"
                              }}
                            />

                            <small
                              style={{
                                fontSize: "11px",

                                fontWeight: selected
                                  ? 600
                                  : 400,

                                textDecoration: available
                                  ? "none"
                                  : "line-through"
                              }}
                            >
                              {color}
                            </small>

                          </div>

                        </button>
                      );
                    })}

                  </div>
                </div>
              )}

              {/* ===================================== */}
              {/* SIZE SELECTION */}
              {/* ===================================== */}

              {sizes.length > 0 && (
                <div className="my-4">

                  <h6 className="fw-bold mb-3">

                    Select Size:{" "}

                    <span
                      style={{
                        color: THEME.primary
                      }}
                    >
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

                      const selected =
                        selectedSize === size;

                      return (
                        <button
                          type="button"
                          key={size}
                          disabled={
                            !available ||
                            addingToCart
                          }
                          aria-pressed={selected}
                          title={
                            available
                              ? `${stock} items available`
                              : "Out of stock"
                          }
                          className="btn px-3"
                          style={{
                            minWidth: "48px",
                            minHeight: "43px",
                            borderRadius: "8px",

                            border:
                              selected && available
                                ? `2px solid ${THEME.primary}`
                                : "2px solid #E5E7EB",

                            backgroundColor:
                              selected && available
                                ? THEME.primary
                                : "#FFFFFF",

                            color:
                              selected && available
                                ? "#FFFFFF"
                                : available
                                  ? THEME.text
                                  : "#999999",

                            textDecoration: available
                              ? "none"
                              : "line-through",

                            opacity: available
                              ? 1
                              : 0.55
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
              {hasVariants &&
                selectedSize &&
                selectedColor && (

                <div
                  className="rounded-3 p-3 my-3"
                  style={{
                    backgroundColor: THEME.light,
                    border: `1px solid ${THEME.border}`
                  }}
                >

                  <div
                    className="small fw-semibold mb-2"
                    style={{
                      color: THEME.primaryDark
                    }}
                  >
                    <i className="bi bi-check2-circle me-2"></i>

                    Selected Variant
                  </div>

                  <div className="d-flex align-items-center gap-2">

                    <span
                      className="rounded-circle"
                      style={{
                        width: "18px",
                        height: "18px",
                        background:
                          getColorHex(selectedColor),

                        border: "1px solid #CCC"
                      }}
                    />

                    <span>
                      {selectedColor} / Size {selectedSize}
                    </span>

                  </div>
                </div>
              )}

              {/* ===================================== */}
              {/* QUANTITY */}
              {/* ===================================== */}

              <div className="my-4">

                <h6 className="fw-bold mb-3">
                  Quantity
                </h6>

                <div
                  className="d-flex align-items-center border rounded-3 overflow-hidden"
                  style={{
                    width: "140px"
                  }}
                >

                  <button
                    className="btn btn-light rounded-0"
                    type="button"
                    aria-label="Decrease quantity"
                    disabled={
                      quantity <= 1 ||
                      isOutOfStock ||
                      addingToCart
                    }
                    onClick={() =>
                      setQuantity(
                        (q) => Math.max(1, q - 1)
                      )
                    }
                  >
                    −
                  </button>

                  <span className="flex-grow-1 text-center fw-semibold">
                    {isOutOfStock ? 0 : quantity}
                  </span>

                  <button
                    className="btn btn-light rounded-0"
                    type="button"
                    aria-label="Increase quantity"
                    disabled={
                      isOutOfStock ||
                      quantity >= availableStock ||
                      addingToCart
                    }
                    onClick={() =>
                      setQuantity(
                        (q) =>
                          Math.min(
                            availableStock,
                            q + 1
                          )
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

              {/* ===================================== */}
              {/* ACTION BUTTONS */}
              {/* ===================================== */}

              <div className="d-grid gap-3 mt-4">

                <button
                  type="button"
                  className="btn btn-lg text-white fw-semibold rounded-3"
                  style={{
                    backgroundColor: isOutOfStock
                      ? "#999999"
                      : THEME.primary,

                    border: "none",
                    minHeight: "52px"
                  }}
                  onClick={handleAddToBag}
                  disabled={
                    isOutOfStock ||
                    addingToCart
                  }
                >

                  {addingToCart ? (
                    <span className="spinner-border spinner-border-sm me-2"></span>
                  ) : (
                    <i className="bi bi-bag me-2"></i>
                  )}

                  {addingToCart
                    ? "ADDING..."
                    : isOutOfStock
                      ? "OUT OF STOCK"
                      : "ADD TO BAG"}

                </button>

                <button
                  type="button"
                  className="btn btn-lg fw-semibold rounded-3"
                  style={{
                    backgroundColor: "#FFFFFF",
                    color: THEME.primaryDark,

                    border:
                      `1px solid ${THEME.primaryDark}`,

                    minHeight: "52px"
                  }}
                  onClick={handleBuyNow}
                  disabled={
                    isOutOfStock ||
                    addingToCart
                  }
                >
                  BUY NOW
                </button>

              </div>

              {/* ===================================== */}
              {/* DELIVERY INFORMATION */}
              {/* ===================================== */}

              <div
                className="rounded-4 p-3 mt-4"
                style={{
                  backgroundColor: "#FAFCFC",
                  border: "1px solid #E5EEEE"
                }}
              >

                {/* DELIVERY */}
                <div className="d-flex gap-3 align-items-center border-bottom py-3">

                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: "44px",
                      height: "44px",
                      backgroundColor: THEME.light,
                      color: THEME.primary
                    }}
                  >
                    <i className="bi bi-truck fs-5"></i>
                  </div>

                  <div>

                    <h6 className="fw-semibold mb-1">
                      Delivery Information
                    </h6>

                    <p className="small text-secondary mb-0">
                      Delivery details will be available at checkout.
                    </p>

                  </div>

                </div>

                {/* RETURN AND EXCHANGE */}
                <div className="d-flex gap-3 align-items-center border-bottom py-3">

                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: "44px",
                      height: "44px",
                      backgroundColor: THEME.light,
                      color: THEME.primary
                    }}
                  >
                    <i className="bi bi-arrow-repeat fs-5"></i>
                  </div>

                  <div>

                    <h6 className="fw-semibold mb-1">
                      Return & Exchange
                    </h6>

                    <p className="small text-secondary mb-0">
                      Please check the return policy before ordering.
                    </p>

                  </div>

                </div>

                {/* PRODUCT INFORMATION */}
                <div className="d-flex gap-3 align-items-center py-3">

                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: "44px",
                      height: "44px",
                      backgroundColor: THEME.light,
                      color: THEME.primary
                    }}
                  >
                    <i className="bi bi-shield-check fs-5"></i>
                  </div>

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