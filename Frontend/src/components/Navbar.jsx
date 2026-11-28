import { useEffect, useState } from "react";
import { Link, useNavigate,useLocation } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import sabkooLogo from "../assets/branding/sabkoo-logo.png";

const API_URL = import.meta.env.VITE_API_URL;

function Navbar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === "/";

  // CATEGORY DATA
  const categories = [
    {
      id: "men",
      label: "Men's",
      columns: [
        {
          title: "Clothing",
          links: [
            "T-Shirts",
            "Shirts",
            "Jeans",
            "Trousers",
            "Ethnic Wear",
            "Jackets & Hoodies",
          ],
        },
      ],
    },
    {
      id: "women",
      label: "Women's",
      columns: [
        {
          title: "Clothing",
          links: [
            "Kurtas & Kurtis",
            "Dresses",
            "Tops & Tees",
            "Jeans & Trousers",
            "Sarees",
            "Ethnic Sets",
          ],
        },
      ],
    },
  ];

  // PROMOTIONAL LINKS
  const promoLinks = [
    {
      label: "Get App",
      href: "#get-app",
      icon: "bi-phone",
    },
    {
      label: "Store & Events",
      href: "#stores",
      icon: "bi-geo-alt",
    },
    {
      label: "Gift Card",
      href: "#gift",
      icon: "bi-gift",
    },
    {
      label: "Help",
      href: "#help",
      icon: "bi-question-circle",
    },
  ];

  // FETCH LOGGED-IN USER
  useEffect(() => {
    let cancelled = false;

    async function fetchLoggedInUser() {
      const token = localStorage.getItem("token");
      const savedUser = localStorage.getItem("user");

      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          localStorage.removeItem("user");
        }
      }

      try {
        const response = await fetch(
          `${API_URL}/api/auth/profile`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (
          cancelled ||
          localStorage.getItem("token") !== token
        ) {
          return;
        }

        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");

          setUser(null);
          setWishlistCount(0);
          setCartCount(0);

          window.dispatchEvent(new Event("authUpdated"));
        } else if (response.ok && data.user) {
          setUser(data.user);

          localStorage.setItem(
            "user",
            JSON.stringify(data.user)
          );
        }
      } catch (error) {
        console.error("Profile error:", error.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchLoggedInUser();

    return () => {
      cancelled = true;
    };
  }, []);

  // FETCH CART COUNT
  useEffect(() => {
    let cancelled = false;
    let requestNumber = 0;

    const updateCartCount = async () => {
      const currentRequest = ++requestNumber;
      const token = localStorage.getItem("token");

      if (!token) {
        setCartCount(0);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/cart`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (
          cancelled ||
          currentRequest !== requestNumber ||
          localStorage.getItem("token") !== token
        ) {
          return;
        }

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          setCartCount(0);
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to fetch cart count.");
        }

        const data = await response.json();

        if (
          cancelled ||
          currentRequest !== requestNumber ||
          localStorage.getItem("token") !== token
        ) {
          return;
        }

        const items = Array.isArray(data.items)
          ? data.items
          : [];

        const count = items.reduce(
          (total, item) =>
            total + Number(item.quantity || 1),
          0
        );

        setCartCount(count);
      } catch (error) {
        if (!cancelled) {
          console.error("Cart count error:", error);
        }
      }
    };

    const handleAuthChange = () => {
      setCartCount(0);
      updateCartCount();
    };

    updateCartCount();

    window.addEventListener(
      "cartUpdated",
      updateCartCount
    );

    window.addEventListener(
      "authUpdated",
      handleAuthChange
    );

    window.addEventListener(
      "storage",
      handleAuthChange
    );

    return () => {
      cancelled = true;
      requestNumber++;

      window.removeEventListener(
        "cartUpdated",
        updateCartCount
      );

      window.removeEventListener(
        "authUpdated",
        handleAuthChange
      );

      window.removeEventListener(
        "storage",
        handleAuthChange
      );
    };
  }, []);

  // FETCH WISHLIST COUNT
  useEffect(() => {
    let cancelled = false;
    let requestNumber = 0;

    async function updateWishlistCount() {
      const currentRequest = ++requestNumber;
      const token = localStorage.getItem("token");

      if (!token) {
        setWishlistCount(0);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/wishlist`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (
          cancelled ||
          currentRequest !== requestNumber ||
          localStorage.getItem("token") !== token
        ) {
          return;
        }

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          setWishlistCount(0);
          return;
        }

        if (!response.ok) {
          throw new Error(
            "Unable to fetch wishlist count"
          );
        }

        const data = await response.json();

        if (
          cancelled ||
          currentRequest !== requestNumber ||
          localStorage.getItem("token") !== token
        ) {
          return;
        }

        setWishlistCount(
          Array.isArray(data.products)
            ? data.products.length
            : 0
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Wishlist count error:",
            error
          );
        }
      }
    }

    updateWishlistCount();

    const handleAuthChange = () => {
      setWishlistCount(0);
      updateWishlistCount();
    };

    window.addEventListener(
      "wishlistUpdated",
      updateWishlistCount
    );

    window.addEventListener(
      "authUpdated",
      handleAuthChange
    );

    window.addEventListener(
      "storage",
      handleAuthChange
    );

    return () => {
      cancelled = true;
      requestNumber++;

      window.removeEventListener(
        "wishlistUpdated",
        updateWishlistCount
      );

      window.removeEventListener(
        "authUpdated",
        handleAuthChange
      );

      window.removeEventListener(
        "storage",
        handleAuthChange
      );
    };
  }, []);

  // CLOSE MENUS
  function closeMenu() {
    setMenuOpen(false);
    setActiveCategory("");
    setAccountOpen(false);
  }

  // TOGGLE MOBILE MENU
  function toggleMobileMenu() {
    setMenuOpen((previous) => !previous);
    setActiveCategory("");
    setAccountOpen(false);
  }

  // LOGOUT
  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);
    setWishlistCount(0);
    setCartCount(0);

    window.dispatchEvent(new Event("authUpdated"));

    closeMenu();
    navigate("/");
  }

  // PROFILE NAVIGATION
  function getProfilePath() {
    if (user?.role === "admin") {
      return "/admin-dashboard?tab=profile";
    }

    if (user?.role === "vendor") {
      return "/vendor-dashboard";
    }

    return "/profile";
  }

  // SEARCH
  function handleSearch(event) {
    event.preventDefault();

    if (search.trim()) {
      navigate(
        `/products?search=${encodeURIComponent(
          search.trim()
        )}`
      );

      closeMenu();
    }
  }

  // CART
  function handleCart() {
    closeMenu();
    navigate("/cart");
  }

  // WISHLIST
  function handleWishlist() {
    closeMenu();

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/signin", {
        state: { from: "/wishlist" },
      });

      return;
    }

    let savedUser = user;

    if (!savedUser) {
      try {
        savedUser = JSON.parse(
          localStorage.getItem("user") || "null"
        );
      } catch {
        savedUser = null;
      }
    }

    if (savedUser?.role === "admin") {
      navigate("/admin-dashboard");
      return;
    }

    if (savedUser?.role === "vendor") {
      navigate("/vendor-dashboard");
      return;
    }

    navigate("/wishlist");
  }

  // CATEGORY LINK
  function getCategoryLink(category, subCategory) {
    return `/products?category=${category}&subCategory=${encodeURIComponent(
      subCategory
    )}`;
  }

  return (
    <div
      className="fixed-header w-100 mw-100"
      style={{
        minWidth: 0,
      }}
    >
      {/* =====================================
          TOP PROMOTIONAL BAR
      ===================================== */}

      <div className="top-promo w-100 d-flex flex-column flex-lg-row justify-content-center justify-content-lg-between align-items-center px-2 px-lg-4 py-2">

        {/* MOBILE PROMOTIONAL TEXT */}

        <div
          className="d-lg-none text-center fw-medium w-100"
          style={{
            fontSize: "12px",
            lineHeight: "1.4",
            overflowWrap: "anywhere",
          }}
        >
          ✦ FASHION FOR EVERY OCCASION
        </div>

        {/* DESKTOP PROMOTIONAL TEXT */}

        <span className="d-none d-lg-block">
          ✦ FASHION FOR EVERY OCCASION
        </span>

        {/* DESKTOP PROMOTIONAL LINKS */}

        <div className="promo-links d-none d-lg-flex align-items-center gap-3">
          {promoLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
            >
              <i className={`bi ${link.icon}`}></i>
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {/* =====================================
          MAIN NAVBAR
      ===================================== */}

      <nav className="main-navbar w-100 mw-100">
        <div
          className="main-nav-inner w-100 d-flex align-items-center justify-content-between px-3 px-lg-4 gap-2 gap-lg-3"
          style={{
            minWidth: 0,
          }}
        >
          {/* LOGO */}

          <Link
            to="/"
            className="nykaa-logo flex-shrink-0"
            onClick={closeMenu}
          >
            <img
              src={sabkooLogo}
              alt="Sabkoo"
              className="img-fluid"
              style={{
                width: "clamp(110px, 32vw, 150px)",
                height: "auto",
                objectFit: "contain",
              }}
            />
          </Link>

          {/* DESKTOP NAVIGATION */}

          <div className="desktop-main-links d-none d-lg-flex align-items-center">
            <Link
              to="/products"
              onClick={closeMenu}
            >
              All Products
            </Link>

            {/* MEN'S AND WOMEN'S DROPDOWNS */}

            {categories.map((category) => (
              <div
                className="category-item"
                key={category.id}
                onMouseEnter={() =>
                  setActiveCategory(category.id)
                }
                onMouseLeave={() =>
                  setActiveCategory("")
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    setActiveCategory(
                      activeCategory === category.id
                        ? ""
                        : category.id
                    )
                  }
                  aria-expanded={
                    activeCategory === category.id
                  }
                >
                  {category.label}

                  <i className="bi bi-chevron-down"></i>
                </button>

                {activeCategory === category.id && (
                  <div className="mega-menu d-flex justify-content-around">
                    {category.columns.map((column) => (
                      <div key={column.title}>
                        <h6>{column.title}</h6>

                        {column.links.map((link) => (
                          <Link
                            to={getCategoryLink(
                              category.id,
                              link
                            )}
                            key={link}
                            onClick={closeMenu}
                          >
                            {link}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* DESKTOP SEARCH */}
          {isHomePage && (
            <form
              className="search-form d-none d-lg-flex align-items-center"
              onSubmit={handleSearch}
              style={{ minWidth: 0 }}
            >
              <i className="bi bi-search search-icon"></i>

              <input
                type="search"
                placeholder="Search on Sabkoo"
                aria-label="Search products"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
          )}

          {/* DESKTOP ACCOUNT AND ACTIONS */}

          <div className="account-cart d-none d-lg-flex align-items-center">
            {loading ? (
              <span className="account-loading">
                Loading...
              </span>
            ) : user ? (
              <div className="account-dropdown">
                <button
                  type="button"
                  className="account-button"
                  onClick={() =>
                    setAccountOpen(!accountOpen)
                  }
                  aria-expanded={accountOpen}
                >
                  <i className="bi bi-person-circle person-icon"></i>

                  <span className="user-name">
                    {user.name}
                  </span>

                  <i className="bi bi-chevron-down"></i>
                </button>

                {accountOpen && (
                  <div className="account-menu">
                    <Link
                      to={getProfilePath()}
                      onClick={closeMenu}
                    >
                      My Profile
                    </Link>

                    <button
                      type="button"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/signin"
                className="signin-button"
                onClick={closeMenu}
              >
                <i className="bi bi-person person-icon"></i>

                Sign In
              </Link>
            )}

            {/* DESKTOP NOTIFICATION BELL */}

            {!loading &&
              user?.role === "customer" && (
                <NotificationBell />
              )}

            {/* DESKTOP WISHLIST */}

            <button
              type="button"
              className="cart-button position-relative"
              onClick={handleWishlist}
              aria-label={`Wishlist with ${wishlistCount} items`}
              title="My Wishlist"
              style={{
                marginRight: "12px",
              }}
            >
              <i className="bi bi-heart cart-icon"></i>

              <span className="cart-count">
                {wishlistCount}
              </span>
            </button>

            {/* DESKTOP CART */}

            <button
              type="button"
              className="cart-button"
              onClick={handleCart}
              aria-label={`Shopping cart with ${cartCount} items`}
            >
              <i className="bi bi-bag cart-icon"></i>

              <span className="cart-count">
                {cartCount}
              </span>
            </button>
          </div>

          {/* =====================================
              MOBILE ACTIONS
          ===================================== */}

          <div className="d-flex d-lg-none align-items-center gap-3 flex-shrink-0">

            {/* MOBILE WISHLIST */}

            <button
              type="button"
              className="cart-button position-relative p-0"
              onClick={handleWishlist}
              aria-label={`Wishlist with ${wishlistCount} items`}
              style={{
                fontSize: "21px",
              }}
            >
              <i className="bi bi-heart"></i>

              {wishlistCount > 0 && (
                <span className="cart-count">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* MOBILE CART */}

            <button
              type="button"
              className="cart-button position-relative p-0"
              onClick={handleCart}
              aria-label={`Shopping cart with ${cartCount} items`}
              style={{
                fontSize: "21px",
              }}
            >
              <i className="bi bi-bag"></i>

              {cartCount > 0 && (
                <span className="cart-count">
                  {cartCount}
                </span>
              )}
            </button>

            {/* MOBILE HAMBURGER */}

            <button
              type="button"
              className="hamburger-button p-0 flex-shrink-0"
              onClick={toggleMobileMenu}
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
            >
              <i
                className={`bi ${
                  menuOpen
                    ? "bi-x-lg"
                    : "bi-list"
                }`}
              ></i>
            </button>
          </div>
        </div>

        {/* MOBILE SEARCH BAR */}
        {isHomePage && (
          <div className="d-lg-none px-3 pb-3">
            <form
              className="input-group w-100"
              onSubmit={handleSearch}
            >
              <span
                className="input-group-text border-end-0 bg-light"
                style={{ color: "#087F80" }}
              >
                <i className="bi bi-search"></i>
              </span>

              <input
                type="search"
                className="form-control bg-light border-start-0"
                placeholder="Search on Sabkoo"
                aria-label="Search products"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  minWidth: 0,
                  fontSize: "14px",
                }}
              />

              <button
                type="submit"
                className="btn text-white flex-shrink-0"
                style={{ backgroundColor: "#087F80" }}
                aria-label="Search"
              >
                Search
              </button>
            </form>
          </div>
        )}

        {/* =====================================
            MOBILE NAVIGATION MENU
        ===================================== */}

        {menuOpen && (
          <div
            id="mobile-navigation"
            className="mobile-menu w-100 mw-100 d-flex d-lg-none flex-column px-3 overflow-auto text-start"
            style={{
              minWidth: 0,
              maxHeight: "calc(100dvh - 190px)",
            }}
          >
            {/* CUSTOMER ACCOUNT */}

            {loading ? (
              <span className="px-3 py-2">
                Loading account...
              </span>
            ) : user ? (
              <div className="mobile-user text-break">
                <i className="bi bi-person-circle me-2"></i>

                Hello, {user.name}
              </div>
            ) : (
              <Link
                to="/signin"
                onClick={closeMenu}
              >
                <i className="bi bi-person me-2"></i>

                Sign In
              </Link>
            )}

            {/* ALL PRODUCTS */}

            <Link
              to="/products"
              onClick={closeMenu}
            >
              <i className="bi bi-grid me-2"></i>

              All Products
            </Link>

            {/* MOBILE CATEGORY DROPDOWNS */}

            {categories.map((category) => (
              <div
                className="mobile-category w-100"
                key={category.id}
              >
                <button
                  type="button"
                  className="mobile-category-button"
                  onClick={() =>
                    setActiveCategory(
                      activeCategory === category.id
                        ? ""
                        : category.id
                    )
                  }
                  aria-expanded={
                    activeCategory === category.id
                  }
                >
                  {category.label}

                  <i
                    className={`bi ${
                      activeCategory === category.id
                        ? "bi-chevron-up"
                        : "bi-chevron-down"
                    }`}
                  ></i>
                </button>

                {activeCategory === category.id && (
                  <div className="mobile-category-list w-100">
                    {category.columns
                      .flatMap(
                        (column) => column.links
                      )
                      .map((link) => (
                        <Link
                          to={getCategoryLink(
                            category.id,
                            link
                          )}
                          key={link}
                          onClick={closeMenu}
                          className="text-break"
                        >
                          {link}
                        </Link>
                      ))}
                  </div>
                )}
              </div>
            ))}

            {/* MOBILE NOTIFICATIONS */}

            {!loading &&
              user?.role === "customer" && (
                <div className="d-flex align-items-center justify-content-between border-bottom py-3 px-1 gap-2">
                  <span>
                    <i className="bi bi-bell me-2"></i>

                    Notifications
                  </span>

                  <NotificationBell
                    onNavigate={closeMenu}
                  />
                </div>
              )}

            {/* MOBILE WISHLIST */}

            <button
              type="button"
              onClick={handleWishlist}
              className="text-start"
            >
              <i className="bi bi-heart me-2"></i>

              My Wishlist ({wishlistCount})
            </button>

            {/* MOBILE CART */}

            <button
              type="button"
              onClick={handleCart}
              className="text-start"
            >
              <i className="bi bi-bag me-2"></i>

              Shopping Cart ({cartCount})
            </button>

            {/* MOBILE PROFILE */}

            {!loading && user && (
              <Link
                to={getProfilePath()}
                onClick={closeMenu}
              >
                <i className="bi bi-person-circle me-2"></i>

                My Profile
              </Link>
            )}

            {/* MOBILE PROMOTIONAL LINKS */}

            <div className="mt-3 mb-2">
              <div
                className="small fw-semibold text-uppercase px-1 mb-2"
                style={{
                  color: "#087F80",
                }}
              >
                More from Sabkoo
              </div>

              {promoLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={closeMenu}
                  className="d-flex align-items-center gap-2 text-decoration-none text-dark border-bottom py-3 px-1"
                  style={{
                    fontSize: "14px",
                  }}
                >
                  <i
                    className={`bi ${link.icon}`}
                    style={{
                      color: "#087F80",
                    }}
                  ></i>

                  {link.label}
                </a>
              ))}
            </div>

            {/* LOGOUT */}

            {!loading && user && (
              <button
                type="button"
                onClick={handleLogout}
                className="text-start text-danger fw-semibold"
              >
                <i className="bi bi-box-arrow-right me-2"></i>

                Logout
              </button>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}

export default Navbar;