
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const API_URL = import.meta.env.VITE_API_URL;

// Reusable filter controls for desktop and mobile
function FilterPanel({
  categories,
  subCategories,
  brands,
  sizes,
  colors,
  selectedCategory,
  setSelectedCategory,
  selectedSubCategory,
  setSelectedSubCategory,
  selectedBrands,
  setSelectedBrands,
  selectedSizes,
  setSelectedSizes,
  selectedColors,
  setSelectedColors,
  maxPrice,
  setMaxPrice,
  clearFilters,
}) {
  const toggleFilter = (value, setSelected) => {
    setSelected((previous) =>
      previous.includes(value)
        ? previous.filter((item) => item !== value)
        : [...previous, value]
    );
  };

  const renderCheckboxes = (items, selected, setSelected, prefix) =>
    items.map((value, index) => (
      <div className="form-check mb-2" key={`${prefix}-${value}`}>
        <input
          className="form-check-input"
          type="checkbox"
          id={`${prefix}-${index}`}
          checked={selected.includes(value)}
          onChange={() => toggleFilter(value, setSelected)}
        />
        <label
          className="form-check-label small"
          htmlFor={`${prefix}-${index}`}
        >
          {value}
        </label>
      </div>
    ));

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0">FILTERS</h5>

        <button
          type="button"
          className="btn btn-link text-danger text-decoration-none p-0 small"
          onClick={clearFilters}
        >
          Clear All
        </button>
      </div>

      {/* CATEGORY */}
      <div className="border-top py-3">
        <h6 className="fw-bold">Category</h6>
        {renderCheckboxes(
          categories,
          selectedCategory,
          setSelectedCategory,
          "category"
        )}
      </div>

      {/* SUBCATEGORY */}
      <div className="border-top py-3">
        <h6 className="fw-bold">Sub Category</h6>
        {renderCheckboxes(
          subCategories,
          selectedSubCategory,
          setSelectedSubCategory,
          "subcategory"
        )}
      </div>

      {/* BRAND */}
      <div className="border-top py-3">
        <h6 className="fw-bold">Brand</h6>
        {renderCheckboxes(
          brands,
          selectedBrands,
          setSelectedBrands,
          "brand"
        )}
      </div>

      {/* PRICE */}
      <div className="border-top py-3">
        <h6 className="fw-bold">Price</h6>

        <p className="small text-secondary mb-2">
          Up to ₹{maxPrice.toLocaleString("en-IN")}
        </p>

        <input
          type="range"
          className="form-range"
          min="0"
          max="10000"
          step="100"
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
        />
      </div>

      {/* SIZE */}
      <div className="border-top py-3">
        <h6 className="fw-bold">Size</h6>

        <div className="d-flex flex-wrap gap-2">
          {sizes.map((size) => (
            <button
              key={size}
              type="button"
              className={`btn btn-sm ${
                selectedSizes.includes(size)
                  ? "btn-danger"
                  : "btn-outline-secondary"
              }`}
              onClick={() => toggleFilter(size, setSelectedSizes)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* COLOR */}
      <div className="border-top py-3">
        <h6 className="fw-bold">Color</h6>

        {renderCheckboxes(
          colors,
          selectedColors,
          setSelectedColors,
          "color"
        )}
      </div>
    </div>
  );
}

function ProductListing() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // WISHLIST STATES
  const [wishlistIds, setWishlistIds] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(null);
  const [wishlistError, setWishlistError] = useState("");
  const [wishlistReady, setWishlistReady] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const searchTerm = (searchParams.get("search") || "")
    .trim()
    .toLowerCase();

  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category")
      ? [searchParams.get("category").toLowerCase()]
      : []
  );

  const [selectedSubCategory, setSelectedSubCategory] = useState(
    searchParams.get("subCategory")
      ? [searchParams.get("subCategory")]
      : []
  );

  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [maxPrice, setMaxPrice] = useState(10000);

  const [sortBy, setSortBy] = useState(
    searchParams.get("sort") === "newest"
      ? "newest"
      : "recommended"
  );

  // Keep category and subcategory in sync with URL
  
  useEffect(() => {
    const category = searchParams.get("category");
    const subCategory = searchParams.get("subCategory");
    const sort = searchParams.get("sort");

    setSelectedCategory(
      category ? [category.toLowerCase()] : []
    );

    setSelectedSubCategory(
      subCategory ? [subCategory] : []
    );

    setSortBy(
      sort === "newest" ? "newest" : "recommended"
    );
  }, [searchParams]);


  // FETCH PRODUCTS
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_URL}/api/products`);

        if (!response.ok) {
          throw new Error("Unable to fetch products");
        }

        const data = await response.json();

        const productList = Array.isArray(data)
          ? data
          : data.products || data.data || [];

        setProducts(productList);
      } catch (err) {
        console.error(err);
        setError("Unable to load products. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  // FETCH LOGGED-IN CUSTOMER WISHLIST
  useEffect(() => {
    const token = localStorage.getItem("token");
    const controller = new AbortController();

    setWishlistReady(false);
    setWishlistError("");
    setWishlistIds([]);

    if (!token) {
      setWishlistReady(true);
      return () => controller.abort();
    }

    async function fetchWishlist() {
      try {
        const response = await fetch(
          `${API_URL}/api/wishlist`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          }
        );

        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.dispatchEvent(new Event("authUpdated"));
          throw new Error("Session expired. Please sign in again.");
        }

        if (!response.ok) {
          throw new Error("Unable to load wishlist.");
        }

        const data = await response.json();

        if (!controller.signal.aborted) {
          setWishlistIds(
            (data.products || [])
              .filter(Boolean)
              .map((product) => product._id)
          );
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Wishlist fetch error:", err);
          setWishlistError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setWishlistReady(true);
        }
      }
    }

    fetchWishlist();

    return () => controller.abort();
  }, []);

  // ADD OR REMOVE PRODUCT FROM WISHLIST
  const handleWishlist = async (event, productId) => {
    event.stopPropagation();

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/signin", {
        state: {
          from: `${location.pathname}${location.search}`,
        },
      });
      return;
    }

    if (!wishlistReady || wishlistLoading) return;

    const isWishlisted = wishlistIds.includes(productId);

    try {
      setWishlistLoading(productId);
      setWishlistError("");

      const response = await fetch(
        `${API_URL}/api/wishlist/${productId}`,
        {
          method: isWishlisted ? "DELETE" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.dispatchEvent(new Event("authUpdated"));

        navigate("/signin", {
          state: {
            from: `${location.pathname}${location.search}`,
          },
        });
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to update wishlist."
        );
      }

      const updatedIds = (data.products || [])
        .filter(Boolean)
        .map((product) => product._id);

      setWishlistIds(updatedIds);

      // Notify Navbar and other wishlist components
      window.dispatchEvent(new Event("wishlistUpdated"));
    } catch (err) {
      console.error("Wishlist update error:", err);
      setWishlistError(
        err.message || "Unable to update wishlist."
      );
    } finally {
      setWishlistLoading(null);
    }
  };

  // FILTER OPTIONS FROM PRODUCTS
  const categories = useMemo(
    () => [
      ...new Set(products.map((p) => p.category).filter(Boolean)),
    ],
    [products]
  );

  const subCategories = useMemo(
    () => [
      ...new Set(products.map((p) => p.subCategory).filter(Boolean)),
    ],
    [products]
  );

  const brands = useMemo(
    () => [
      ...new Set(products.map((p) => p.brand).filter(Boolean)),
    ],
    [products]
  );

  const sizes = useMemo(
    () => [
      ...new Set(
        products.flatMap((p) => p.sizes || []).filter(Boolean)
      ),
    ],
    [products]
  );

  const colors = useMemo(
    () => [
      ...new Set(
        products.flatMap((p) => p.colors || []).filter(Boolean)
      ),
    ],
    [products]
  );

  // SEARCH AND FILTER PRODUCTS
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // SEARCH
    if (searchTerm) {
      result = result.filter((product) => {
        const searchableFields = [
          product.productName,
          product.description,
          product.brand,
          product.category,
          product.subCategory,
        ];

        return searchableFields
          .filter(Boolean)
          .some((field) =>
            String(field)
              .toLowerCase()
              .split(/\s+/)
              .some((word) => word.startsWith(searchTerm))
          );
      });
    }

    // CATEGORY
    if (selectedCategory.length) {
      result = result.filter((product) =>
        selectedCategory.some(
          (category) =>
            product.category?.trim().toLowerCase() ===
            category.trim().toLowerCase()
        )
      );
    }

    // SUBCATEGORY
    if (selectedSubCategory.length) {
      result = result.filter((product) =>
        selectedSubCategory.some(
          (subCategory) =>
            product.subCategory?.trim().toLowerCase() ===
            subCategory.trim().toLowerCase()
        )
      );
    }

    // BRAND
    if (selectedBrands.length) {
      result = result.filter((product) =>
        selectedBrands.includes(product.brand)
      );
    }

    // SIZE
    if (selectedSizes.length) {
      result = result.filter((product) =>
        (product.sizes || []).some((size) =>
          selectedSizes.includes(size)
        )
      );
    }

    // COLOR
    if (selectedColors.length) {
      result = result.filter((product) =>
        (product.colors || []).some((color) =>
          selectedColors.includes(color)
        )
      );
    }

    // PRICE
    result = result.filter(
      (product) =>
        Number(product.discountPrice || product.price || 0) <=
        maxPrice
    );

    // SORT
    if (sortBy === "lowToHigh") {
      result.sort(
        (a, b) =>
          Number(a.discountPrice || a.price || 0) -
          Number(b.discountPrice || b.price || 0)
      );
    }

    if (sortBy === "highToLow") {
      result.sort(
        (a, b) =>
          Number(b.discountPrice || b.price || 0) -
          Number(a.discountPrice || a.price || 0)
      );
    }

    if (sortBy === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0)
      );
    }

    return result;
  }, [
    products,
    searchTerm,
    selectedCategory,
    selectedSubCategory,
    selectedBrands,
    selectedSizes,
    selectedColors,
    maxPrice,
    sortBy,
  ]);

  // CLEAR FILTERS
  const clearFilters = () => {
    setSelectedCategory([]);
    setSelectedSubCategory([]);
    setSelectedBrands([]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setMaxPrice(10000);
    setSortBy("recommended");
    setSearchParams({});
  };

  // IMAGE HELPER
  const getProductImage = (product) =>
    product.images?.[0]?.url ||
    "https://placehold.co/400x500?text=No+Image";

  // DISCOUNT HELPER
  const getDiscount = (product) => {
    const price = Number(product.price);
    const discountedPrice = Number(product.discountPrice);

    if (price > discountedPrice && discountedPrice > 0) {
      return Math.round(
        ((price - discountedPrice) / price) * 100
      );
    }

    return 0;
  };

  // SHARED FILTER PROPS
  const filterProps = {
    categories,
    subCategories,
    brands,
    sizes,
    colors,
    selectedCategory,
    setSelectedCategory,
    selectedSubCategory,
    setSelectedSubCategory,
    selectedBrands,
    setSelectedBrands,
    selectedSizes,
    setSelectedSizes,
    selectedColors,
    setSelectedColors,
    maxPrice,
    setMaxPrice,
    clearFilters,
  };

  return (
    <div className="bg-white min-vh-100">
      <Navbar />

      <main className="container-fluid px-3 px-lg-5 pt-5 pb-4 mt-5">
        {/* BREADCRUMB */}
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb small">
            <li className="breadcrumb-item">
              <button
                type="button"
                className="btn btn-link p-0 text-decoration-none text-secondary small"
                onClick={() => navigate("/")}
              >
                Home
              </button>
            </li>
            <li className="breadcrumb-item active">
              Clothing
            </li>
          </ol>
        </nav>

        {/* HEADING */}
        <div className="mb-4">
          <h2 className="fw-bold" style={{ color: "#f3338f" }}>Discover Your Style</h2>
          <p className="text-secondary mb-0">
            Explore the latest fashion collections for men and women.
          </p>
        </div>

        {searchTerm && (
          <p className="mb-3">
            Showing results for: <strong>{searchTerm}</strong>
          </p>
        )}

        <div className="row g-4">
          {/* DESKTOP FILTER SIDEBAR */}
          <aside className="col-lg-3 col-xl-2 d-none d-lg-block">
            <div className="border rounded-3 p-3">
              <FilterPanel {...filterProps} />
            </div>
          </aside>

          {/* PRODUCTS */}
          <section className="col-12 col-lg-9 col-xl-10">
            {/* TOOLBAR */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
              <h6 className="mb-0 fw-semibold">
                {filteredProducts.length} Products
              </h6>

              <div className="d-flex align-items-center flex-wrap gap-2">
                {/* MOBILE FILTER BUTTON */}
                <button
                  type="button"
                  className="btn btn-outline-dark btn-sm d-lg-none"
                  onClick={() => setShowMobileFilters(true)}
                >
                  <i className="bi bi-sliders me-2"></i>
                  Filters
                </button>

                <label
                  htmlFor="sortProducts"
                  className="small text-secondary mb-0"
                >
                  Sort By:
                </label>

                <select
                  id="sortProducts"
                  className="form-select form-select-sm w-auto"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="recommended">Recommended</option>
                  <option value="newest">What's New</option>
                  <option value="lowToHigh">Price: Low to High</option>
                  <option value="highToLow">Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* LOADING */}
            {loading && (
              <div className="text-center py-5">
                <div
                  className="spinner-border text-danger"
                  role="status"
                >
                  <span className="visually-hidden">
                    Loading...
                  </span>
                </div>
                <p className="mt-2 text-secondary">
                  Loading products...
                </p>
              </div>
            )}

            {/* ERROR */}
            {!loading && error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            {/* WISHLIST ERROR */}
            {wishlistError && (
              <div className="alert alert-warning" role="alert">
                {wishlistError}
              </div>
            )}

            {/* EMPTY RESULTS */}
            {!loading &&
              !error &&
              filteredProducts.length === 0 && (
                <div className="text-center py-5">
                  <i className="bi bi-bag-x display-3 text-secondary"></i>
                  <h5 className="mt-3">No products found</h5>
                  <p className="text-secondary">
                    Try changing your search or filters.
                  </p>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={clearFilters}
                  >
                    Clear Filters
                  </button>
                </div>
              )}

            {/* PRODUCT GRID */}
            {!loading &&
              !error &&
              filteredProducts.length > 0 && (
                <div className="row row-cols-2 row-cols-md-3 row-cols-xl-4 g-3 g-lg-4">
                  {filteredProducts.map((product) => {
                    const discount = getDiscount(product);
                    const isWishlisted = wishlistIds.includes(
                      product._id
                    );

                    return (
                      <div
                        className="col"
                        key={product._id}
                      >
                        <div className="card h-100 border-0 shadow-sm">
                          <div
                            className="position-relative overflow-hidden"
                            role="button"
                            onClick={() =>
                              navigate(
                                `/products/${product._id}`
                              )
                            }
                          >
                            <img
                              src={getProductImage(product)}
                              className="card-img-top w-100 object-fit-cover"
                              style={{
                                aspectRatio: "3 / 4",
                                objectPosition: "center top",
                              }}
                              alt={product.productName}
                            />

                            {discount > 0 && (
                              <span className="badge bg-danger position-absolute top-0 start-0 m-2">
                                {discount}% OFF
                              </span>
                            )}

                            {/* FUNCTIONAL WISHLIST BUTTON */}
                            <button
                              type="button"
                              className="btn btn-light btn-sm rounded-circle position-absolute top-0 end-0 m-2 d-flex align-items-center justify-content-center p-2 shadow-sm"
                              aria-label={
                                isWishlisted
                                  ? "Remove from wishlist"
                                  : "Add to wishlist"
                              }
                              aria-pressed={isWishlisted}
                              disabled={
                                wishlistLoading !== null ||
                                (!wishlistReady &&
                                  !!localStorage.getItem("token"))
                              }
                              onClick={(e) =>
                                handleWishlist(e, product._id)
                              }
                            >
                              {wishlistLoading === product._id ? (
                                <span
                                  className="spinner-border spinner-border-sm text-danger"
                                  role="status"
                                  aria-label="Updating wishlist"
                                ></span>
                              ) : (
                                <i
                                  className={`bi ${
                                    isWishlisted
                                      ? "bi-heart-fill text-danger"
                                      : "bi-heart"
                                  }`}
                                ></i>
                              )}
                            </button>
                          </div>

                          <div
                            className="card-body px-1 py-2"
                            role="button"
                            onClick={() =>
                              navigate(
                                `/products/${product._id}`
                              )
                            }
                          >
                            <h6 className="fw-bold mb-1">
                              {product.brand ||
                                "Nykaa Store"}
                            </h6>

                            <p className="small text-secondary text-truncate mb-2">
                              {product.productName}
                            </p>

                            <div className="d-flex flex-wrap align-items-center gap-2">
                              <strong className="small">
                                ₹
                                {Number(
                                  product.discountPrice ||
                                    product.price ||
                                    0
                                ).toLocaleString("en-IN")}
                              </strong>

                              {discount > 0 && (
                                <>
                                  <del className="small text-secondary">
                                    ₹
                                    {Number(
                                      product.price
                                    ).toLocaleString("en-IN")}
                                  </del>

                                  <span className="small text-danger">
                                    {discount}% OFF
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </section>
        </div>
      </main>

      {/* MOBILE FILTER OFFCANVAS */}
      {showMobileFilters && (
        <>
          <div
            className="offcanvas-backdrop fade show d-lg-none"
            onClick={() => setShowMobileFilters(false)}
          ></div>

          <div
            className="offcanvas offcanvas-start show d-lg-none"
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
            aria-label="Product filters"
            style={{
            visibility: "visible",
            height: "100dvh",
            maxHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
          }}
          >
            <div className="offcanvas-header border-bottom">
              <h5 className="offcanvas-title fw-bold">
                Filter Products
              </h5>

              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={() => setShowMobileFilters(false)}
              ></button>
            </div>

            <div
              className="offcanvas-body overflow-auto"
              style={{
                padding: "20px 18px 28px",
                minHeight: 0,
              }}
            >
              <FilterPanel {...filterProps} />
            </div>
            <div
              className="p-3 border-top bg-white"
              style={{
                paddingBottom: "max(16px, env(safe-area-inset-bottom))",
              }}
            >
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  style={{ minWidth: "100px" }}
                  onClick={clearFilters}
                >
                  Clear All
                </button>

                <button
                  type="button"
                  className="btn btn-danger flex-grow-1"
                  onClick={() => setShowMobileFilters(false)}
                >
                  Show {filteredProducts.length} Products
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <Footer showSocial={false} />
    </div>
  );
}

export default ProductListing;
