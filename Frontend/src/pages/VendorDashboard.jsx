
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProductTable from "../components/ProductTable";
import AddProduct from "../components/AddProduct"
import StoreProfile from "../components/StoreProfile";
import EditProduct from "../components/EditProduct";
import Orders from "../components/Orders";

const API_URL = import.meta.env.VITE_API_URL;

function VendorDashboard() {
  const [products, setProducts] = useState([]);
  const [vendorOrders, setVendorOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);


const [menuHistory, setMenuHistory] = useState([]);


const handleMenuChange = (menu) => {
  if (menu !== activeMenu) {
    setMenuHistory((previous) => [...previous, activeMenu]);
    setActiveMenu(menu);
  }

  if (menu === "Orders") {
    fetchVendorOrders();
  }

  setMobileMenuOpen(false);
};


const handleBack = () => {
  if (menuHistory.length > 0) {
    const previousMenu = menuHistory[menuHistory.length - 1];
    setMenuHistory((previous) => previous.slice(0, -1));
    setActiveMenu(previousMenu);
  } else {
    setActiveMenu("Dashboard");
  }
};


  // Edit product states
 const [editingProduct, setEditingProduct] = useState(null);

  const navigate = useNavigate();

  // Fetch vendor profile and own products
  useEffect(() => {
    const fetchVendorData = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("Please sign in again.");
        }

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [profileRes, productsRes] = await Promise.all([
          fetch(`${API_URL}/api/auth/profile`, { headers }),
          fetch(`${API_URL}/api/products/mine`, { headers }),
        ]);

        if (!profileRes.ok || !productsRes.ok) {
          throw new Error("Unable to fetch vendor information.");
        }

        const profileData = await profileRes.json();
        const productsData = await productsRes.json();

        if (profileData.user) {
          setUser(profileData.user);
          localStorage.setItem(
            "user",
            JSON.stringify(profileData.user)
          );
        }

        setProducts(productsData.products || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchVendorData();
  }, []);
  // FETCH ORDERS FOR LOGGED-IN VENDOR
  const fetchVendorOrders = async () => {
    try {
      setOrdersLoading(true);
      setOrdersError("");

      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Please sign in again.");
      }

      const response = await fetch(
        `${API_URL}/api/orders/vendor`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to fetch vendor orders."
        );
      }

      setVendorOrders(data.orders || []);
    } catch (error) {
      console.error("Vendor orders error:", error);
      setOrdersError(
        error.message || "Unable to fetch vendor orders."
      );
    } finally {
      setOrdersLoading(false);
    }
  };

  // Refresh vendor products
  const fetchMyProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Please sign in again.");
      }

      const response = await fetch(
        `${API_URL}/api/products/mine`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to fetch products."
        );
      }

      setProducts(data.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");

    navigate("/signin", { replace: true });
  };

  // Product statistics
  const totalProducts = products.length;

  const inStock = products.filter(
    (product) => Number(product.stock) > 0
  ).length;

  const outOfStock = products.filter(
    (product) => Number(product.stock) <= 0
  ).length;

  const totalStock = products.reduce(
    (total, product) => total + Number(product.stock || 0),
    0
  );

  // Delete product
  const handleDelete = async (productId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this product?"
    );

    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/api/products/${productId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to delete product."
        );
      }

      setProducts((previousProducts) =>
        previousProducts.filter(
          (product) => product._id !== productId
        )
      );
    } catch (err) {
      alert(err.message);
    }
  };


 // Open reusable edit component
    const handleEdit = (product) => {
    setEditingProduct(product);
    };
  // Sidebar menu
  const menuItems = [
    { name: "Dashboard", icon: "bi-grid-1x2-fill" },
    { name: "Add Product", icon: "bi-plus-circle-fill" },
    { name: "My Products", icon: "bi-bag-fill" },
    { name: "Orders", icon: "bi-receipt" },
    { name: "Store Profile", icon: "bi-shop" },
  ];

  // Overview cards
  const overviewCards = [
    {
      title: "Total Products",
      count: totalProducts,
      icon: "bi-box-seam-fill",
      bg: "#eee8ff",
      color: "#8054d6",
    },
    {
      title: "Product In Stock",
      count: inStock,
      icon: "bi-check-circle-fill",
      bg: "#d9f7ef",
      color: "#13a98c",
    },
    {
      title: "Out of Stock",
      count: outOfStock,
      icon: "bi-exclamation-circle-fill",
      bg: "#ffe5ef",
      color: "#fc2779",
    },
    {
      title: "Total Stock",
      count: totalStock,
      icon: "bi-boxes",
      bg: "#fff0dc",
      color: "#ed9634",
    },
  ];

  
  return (
  <div
    className="d-flex flex-column min-vh-100"
    style={{ backgroundColor: "#faf9fb" }}
  >
    {/* MOBILE NAVBAR */}
    <div className="d-md-none bg-white border-bottom w-100">
      <div className="d-flex align-items-center justify-content-between px-3 py-3">
        <div className="d-flex align-items-center gap-2">
          <i
            className="bi bi-bag-heart-fill fs-4"
            style={{ color: "#fc2779" }}
          ></i>
          <span className="fw-bold fs-5">
            Nykaa Store
          </span>
        </div>

        <button
          type="button"
          className="btn btn-light border"
          onClick={() => setMobileMenuOpen((previous) => !previous)}
          aria-label="Toggle navigation"
          aria-expanded={mobileMenuOpen}
          aria-controls="vendor-mobile-menu"
        >
          <i
            className={`bi ${
              mobileMenuOpen ? "bi-x-lg" : "bi-list"
            } fs-5`}
          ></i>
        </button>
      </div>

      {mobileMenuOpen && (
        <nav id="vendor-mobile-menu" className="border-top p-3">
          <div className="d-flex flex-column gap-1">
            {menuItems.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => handleMenuChange(item.name)}
                className="btn text-start d-flex align-items-center gap-3 w-100"
                style={{
                  backgroundColor:
                    activeMenu === item.name ? "#fff0f5" : "transparent",
                  color:
                    activeMenu === item.name ? "#fc2779" : "#555",
                  fontWeight:
                    activeMenu === item.name ? "600" : "400",
                  border: "none",
                  padding: "12px",
                  borderRadius: "8px",
                }}
              >
                <i className={`bi ${item.icon}`}></i>
                {item.name}
              </button>
            ))}

            <hr className="my-2" />

            <button
              type="button"
              onClick={handleLogout}
              className="btn text-start text-danger d-flex align-items-center gap-3"
            >
              <i className="bi bi-box-arrow-right"></i>
              Logout
            </button>
          </div>
        </nav>
      )}
    </div>

    <div className="row flex-grow-1 g-0">


        {/* SIDEBAR */}
        <aside className="d-none d-md-flex col-md-3 col-lg-2 bg-white border-end p-3 flex-column">
          <h3
            className="fw-bold text-center mb-4"
            style={{ color: "#fc2779" }}
          >
            nykaa
          </h3>

          <p className="text-secondary small fw-semibold mb-2">
            VENDOR MENU
          </p>

          <div className="d-flex flex-row flex-md-column flex-wrap gap-2">
            {menuItems.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => handleMenuChange(item.name)}
                className="btn text-start border-0 rounded-3"
                style={{
                  backgroundColor:
                    activeMenu === item.name
                      ? "#fff0f5"
                      : "transparent",
                  color:
                    activeMenu === item.name
                      ? "#fc2779"
                      : "#555",
                  fontWeight:
                    activeMenu === item.name ? "600" : "400",
                }}
              >
                <i className={`bi ${item.icon} me-2`}></i>
                {item.name}
              </button>
            ))}
          </div>

          {/* LOGOUT */}
          <div className="mt-md-auto mt-4">
            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-outline-danger w-100"
            >
              <i className="bi bi-box-arrow-right me-2"></i>
              Logout
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="col-12 col-md-9 col-lg-10 p-3 p-md-4">

          {/* TOP HEADER */}
          <div className="d-flex justify-content-between align-items-center bg-white rounded-3 border p-3 mb-4">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              {activeMenu !== "Dashboard" && (
                <button
                  type="button"
                  className="btn btn-link text-dark p-0 border-0"
                  onClick={handleBack}
                  aria-label="Go back"
                  title="Go back"
                >
                  <i className="bi bi-arrow-left fs-5"></i>
                </button>
              )}

              <h5 className="fw-bold mb-0">
                {activeMenu}
              </h5>
            </div>

            <small className="text-secondary">
              Vendor Panel
            </small>
          </div>


            {/* USER GREETING */}
            <div className="d-flex align-items-center gap-2">
              <div
                className="rounded-circle d-flex justify-content-center align-items-center text-white fw-bold"
                style={{
                  width: "38px",
                  height: "38px",
                  backgroundColor: "#fc2779",
                }}
              >
                {user?.name?.charAt(0)?.toUpperCase() || "V"}
              </div>

              <span className="fw-semibold small">
                Hi, {user?.name || "Vendor"}
              </span>
            </div>
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <div className="alert alert-danger">
              {error}

              <button
                type="button"
                className="btn btn-sm btn-outline-danger ms-3"
                onClick={fetchMyProducts}
              >
                Retry
              </button>
            </div>
          )}

          {/* DASHBOARD */}
          {activeMenu === "Dashboard" && (
            <>
              <div className="mb-4">
                <h4 className="fw-bold">
                  Hi, {user?.name || "Vendor"}! 👋
                </h4>

                <p className="text-secondary mb-0">
                  Manage your store and products from here.
                </p>
              </div>

              {/* OVERVIEW CARDS */}
              <div className="row g-3 mb-4">
                {overviewCards.map((card) => (
                  <div
                    className="col-6 col-xl-3"
                    key={card.title}
                  >
                    <div className="card border-0 shadow-sm h-100 rounded-4">
                      <div className="card-body p-3">
                        <div
                          className="rounded-3 d-flex justify-content-center align-items-center mb-3"
                          style={{
                            width: "45px",
                            height: "45px",
                            backgroundColor: card.bg,
                            color: card.color,
                          }}
                        >
                          <i className={`bi ${card.icon} fs-5`}></i>
                        </div>

                        <h3 className="fw-bold mb-1">
                          {loading ? "..." : card.count}
                        </h3>

                        <p className="text-secondary small mb-0">
                          {card.title}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* QUICK ACTIONS */}
              <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-body p-4">
                  <h5 className="fw-bold mb-3">
                    Quick Actions
                  </h5>
                  <button
                    type="button"
                    className="btn text-white me-2 mb-2"
                    style={{ backgroundColor: "#fc2779" }}
                    onClick={() => handleMenuChange("Add Product")}
                    >
                    <i className="bi bi-plus-circle me-2"></i>
                    Add New Product
                  </button>

                  <button
                    type="button"
                    className="btn text-white me-2 mb-2"
                    style={{ backgroundColor: "#fc2779" }}
                    onClick={() => handleMenuChange("My Products")}
                  >
                    <i className="bi bi-bag-fill me-2"></i>
                    View My Products
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-secondary mb-2"
                    onClick={fetchMyProducts}
                  >
                    <i className="bi bi-arrow-clockwise me-2"></i>
                    Refresh Products
                  </button>
                </div>
              </div>

              {/* RECENT PRODUCTS */}
              <div className="card border-0 shadow-sm rounded-4">
                <div className="card-body p-3 p-md-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="fw-bold mb-0">
                      My Recent Products
                    </h5>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => handleMenuChange("My Products")}
                    >
                      View All
                    </button>
                  </div>

                  {loading ? (
                    <p className="text-secondary">
                      Loading products...
                    </p>
                  ) : products.length === 0 ? (
                    <p className="text-secondary mb-0">
                      You haven't added any products yet.
                    </p>
                  ) : (
                    <div className="row g-3">
                      {products.slice(0, 4).map((product) => (
                        <div
                          className="col-6 col-lg-3"
                          key={product._id}
                        >
                          <div className="border rounded-3 p-2 h-100">
                            {product.images?.[0]?.url ? (
                              <img
                                src={product.images[0].url}
                                alt={product.productName}
                                className="img-fluid rounded-2 mb-2 w-100"
                                style={{
                                  height: "150px",
                                  objectFit: "cover",
                                  objectPosition: "center top",
                                }}
                              />
                            ) : (
                              <div
                                className="bg-light rounded-2 mb-2 d-flex justify-content-center align-items-center"
                                style={{ height: "130px" }}
                              >
                                <i className="bi bi-image fs-1 text-secondary"></i>
                              </div>
                            )}

                            <p className="fw-semibold small mb-1">
                              {product.productName}
                            </p>

                            <p className="text-secondary small mb-0">
                              ₹{product.discountPrice || product.price}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* MY PRODUCTS - REUSABLE COMPONENT */}
          {activeMenu === "Add Product" && (
            <AddProduct
                 onProductAdded={() => {
                 fetchMyProducts();
                  handleMenuChange("My Products");
                }}
                />
            )}

          {activeMenu === "My Products" && (
            <ProductTable
              products={products}
              loading={loading}
              showEdit={true}
              showDelete={true}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
          {activeMenu === "Store Profile" && (
            <StoreProfile vendor={user} />
          )}

          {/* VENDOR ORDERS */}
          {activeMenu === "Orders" && (
            <>
              {ordersLoading ? (
                <div className="text-center py-5">
                  <div
                    className="spinner-border"
                    style={{ color: "#fc2779" }}
                    role="status"
                  >
                    <span className="visually-hidden">
                      Loading orders...
                    </span>
                  </div>

                  <p className="text-secondary mt-3">
                    Loading customer orders...
                  </p>
                </div>
              ) : ordersError ? (
                <div className="alert alert-danger">
                  <p className="mb-2">{ordersError}</p>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={fetchVendorOrders}
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  <div className="d-flex justify-content-end mb-3">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={fetchVendorOrders}
                    >
                      <i className="bi bi-arrow-clockwise me-2"></i>
                      Refresh Orders
                    </button>
                  </div>

                  <Orders
                    isVendor={true}
                    orders={vendorOrders}
                  />
                </>
              )}
            </>
          )}

        </main>
      </div>

      {/* REUSABLE EDIT PRODUCT COMPONENT */}
      {editingProduct && (
        <EditProduct
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onUpdated={(updatedProduct) => {
            setProducts((previous) =>
              previous.map((item) =>
                item._id === updatedProduct._id
                  ? updatedProduct
                  : item
              )
            );
          }}
        />
      )}
    </div>
  );
}

export default VendorDashboard;
