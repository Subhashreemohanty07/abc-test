
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

  // WISHLIST
  const [wishlistCount, setWishlistCount] = useState(0);

  const navigate = useNavigate();

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

        if (cancelled) return;

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

  
  // FETCH CART COUNT FROM MONGODB
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
        const response = await fetch(`${API_URL}/api/cart`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (
          cancelled ||
          currentRequest !== requestNumber ||
          localStorage.getItem("token") !== token
        ) {
          return;
        }

        if (response.status === 401 || response.status === 403) {
          setCartCount(0);
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to fetch cart count.");
        }

        const data = await response.json();

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


  // FETCH WISHLIST COUNT FOR LOGGED-IN CUSTOMER
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

        if (response.status === 401) {
          setWishlistCount(0);
          return;
        }

        // Wishlist API is customer-only
        if (response.status === 403) {
          setWishlistCount(0);
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to fetch wishlist count");
        }

        const data = await response.json();

        setWishlistCount(
          Array.isArray(data.products)
            ? data.products.length
            : 0
        );
      } catch (error) {
        if (!cancelled) {
          console.error("Wishlist count error:", error);
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
        `/products?search=${encodeURIComponent(search.trim())}`
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
    <div className="fixed-header">
      {/* TOP PROMOTIONAL BAR */}
      <div className="top-promo d-flex justify-content-between align-items-center px-4">
        <span>✦ FASHION FOR EVERY OCCASION</span>

        <div className="promo-links d-flex align-items-center gap-3">
          <a href="#get-app">
            <i className="bi bi-phone"></i> Get App
          </a>

          <a href="#stores">
            <i className="bi bi-geo-alt"></i> Store & Events
          </a>

          <a href="#gift">
            <i className="bi bi-gift"></i> Gift Card
          </a>

          <a href="#help">
            <i className="bi bi-question-circle"></i> Help
          </a>
        </div>
      </div>

      {/* MAIN NAVBAR */}
      <nav className="main-navbar">
        <div className="main-nav-inner d-flex align-items-center justify-content-between">
          {/* LOGO */}
          <Link
            to="/"
            className="nykaa-logo"
            onClick={closeMenu}
          >
            <img
              src={sabkooLogo}
              alt="Sabkoo"
              style={{
                width: "150px",
                height: "auto",
                objectFit: "contain"
              }}
            />
          </Link>

          {/* DESKTOP LINKS */}
          <div className="desktop-main-links d-none d-lg-flex align-items-center">
            <Link to="/products" onClick={closeMenu}>
              All Products
            </Link>

            {/* MEN AND WOMEN DROPDOWNS */}
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
          <form
            className="search-form d-none d-lg-flex align-items-center"
            onSubmit={handleSearch}
          >
            <i className="bi bi-search search-icon"></i>

            <input
              type="search"
              placeholder="Search on Sabkoo"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />
          </form>

          {/* ACCOUNT, WISHLIST AND CART */}
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
              >
                <i className="bi bi-person person-icon"></i>
                Sign In
              </Link>
            )}
            {/* CUSTOMER NOTIFICATION BELL */}
            {!loading && user?.role === "customer" && (
              <NotificationBell />
            )}

            {/* WISHLIST ICON BEFORE CART */}
            <button
              type="button"
              className="cart-button position-relative"
              onClick={handleWishlist}
              aria-label={`Wishlist with ${wishlistCount} items`}
              title="My Wishlist"
              style={{ marginRight: "12px" }}
            >
              <i
                className="bi bi-heart cart-icon"
              ></i>

              <span className="cart-count">
                {wishlistCount}
              </span>
            </button>

            {/* CART ICON */}
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

          {/* MOBILE HAMBURGER */}
          <button
            type="button"
            className="hamburger-button d-lg-none"
            onClick={() =>
              setMenuOpen(!menuOpen)
            }
            aria-label="Toggle menu"
          >
            <i
              className={`bi ${
                menuOpen ? "bi-x-lg" : "bi-list"
              }`}
            ></i>
          </button>
        </div>

        {/* MOBILE MENU */}
        {menuOpen && (
          <div className="mobile-menu d-flex flex-column">

            {/* CUSTOMER NAME FIRST */}
            {loading ? (
              <span className="px-3 py-2">
                Loading account...
              </span>
            ) : user ? (
              <div className="mobile-user">
                <i className="bi bi-person-circle me-2"></i>
                Hello, {user.name}
              </div>
            ) : (
              <Link to="/signin" onClick={closeMenu}>
                <i className="bi bi-person me-2"></i>
                Sign In
              </Link>
            )}

            {/* SEARCH */}
            <form
              className="mobile-search d-flex gap-2"
              onSubmit={handleSearch}
            >
              <input
                type="search"
                placeholder="Search on Sabkoo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button type="submit" aria-label="Search">
                <i className="bi bi-search"></i>
              </button>
            </form>

            {/* ALL PRODUCTS */}
            <Link to="/products" onClick={closeMenu}>
              All Products
            </Link>

            {/* MEN'S AND WOMEN'S CATEGORIES */}
            {categories.map((category) => (
              <div
                className="mobile-category"
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
                  aria-expanded={activeCategory === category.id}
                >
                  {category.label}
                  <i className="bi bi-chevron-down"></i>
                </button>

                {activeCategory === category.id && (
                  <div className="mobile-category-list">
                    {category.columns
                      .flatMap((column) => column.links)
                      .map((link) => (
                        <Link
                          to={getCategoryLink(category.id, link)}
                          key={link}
                          onClick={closeMenu}
                        >
                          {link}
                        </Link>
                      ))}
                  </div>
                )}
              </div>
            ))}

            {/* NOTIFICATIONS */}
            {!loading && user?.role === "customer" && (
              <div
                className="d-flex align-items-center justify-content-between"
                style={{ padding: "8px 15px", gap: "10px" }}
              >
                <span>
                  <i className="bi bi-bell me-2"></i>
                  Notifications
                </span>
                <NotificationBell onNavigate={closeMenu} />
              </div>
            )}

            {/* WISHLIST */}
            <button
              type="button"
              onClick={handleWishlist}
              className="text-start"
            >
              <i className="bi bi-heart me-2"></i>
              My Wishlist ({wishlistCount})
            </button>

            {/* SHOPPING CART */}
            <button
              type="button"
              onClick={handleCart}
              className="text-start"
            >
              <i className="bi bi-bag me-2"></i>
              Shopping Cart ({cartCount})
            </button>

            {/* MY PROFILE */}
            {!loading && user && (
              <Link
                to={getProfilePath()}
                onClick={closeMenu}
              >
                <i className="bi bi-person-circle me-2"></i>
                My Profile
              </Link>
            )}

            {/* LOGOUT LAST */}
            {!loading && user && (
              <button
                type="button"
                onClick={handleLogout}
                className="text-start"
                style={{
                  color: "#dc3545",
                  fontWeight: "600",
                }}
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
