
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import UserVendorTable from "../components/UserVendorTable";
import ProductTable from "../components/ProductTable";
import EditProduct from "../components/EditProduct";
import AdminCustomerActivity from "../components/AdminCustomerActivity";
import ProfileDetails from "../components/ProfileDetails";
import AdminNotifications from "../components/AdminNotifications";

const API_URL = import.meta.env.VITE_API_URL;

function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [adminOrders, setAdminOrders] = useState([]);
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
  const [activeMenu, setActiveMenu] = useState(() => {
  return new URLSearchParams(window.location.search).get("tab") === "profile"
    ? "Profile"
    : "Dashboard";
});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const navigate = useNavigate();

  // FETCH ADMIN DASHBOARD DATA
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error(
            "Admin token not found. Please login again."
          );
        }

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [
          profileRes,
          usersRes,
          vendorsRes,
          productsRes,
        ] = await Promise.all([
          fetch(`${API_URL}/api/auth/profile`, { headers }),
          fetch(`${API_URL}/api/admin/users`, { headers }),
          fetch(`${API_URL}/api/admin/vendors`, { headers }),
          fetch(`${API_URL}/api/products`, { headers }),
        ]);

        if (
          !profileRes.ok ||
          !usersRes.ok ||
          !vendorsRes.ok ||
          !productsRes.ok
        ) {
          throw new Error(
            "Unable to fetch dashboard information."
          );
        }

        const profileData = await profileRes.json();
        const usersData = await usersRes.json();
        const vendorsData = await vendorsRes.json();
        const productsData = await productsRes.json();

        if (profileData.user) {
          setUser(profileData.user);

          localStorage.setItem(
            "user",
            JSON.stringify(profileData.user)
          );
        }

        setUsers(usersData.users || []);
        setVendors(vendorsData.vendors || []);

        setProducts(
          Array.isArray(productsData)
            ? productsData
            : productsData.products || []
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);


  // FETCH ALL CUSTOMER ORDERS FOR ADMIN
  const fetchAdminOrders = async () => {
    try {
      setOrdersLoading(true);
      setOrdersError("");

      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Admin login required.");
      }

      const response = await fetch(
        `${API_URL}/api/orders/admin`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to fetch customer orders."
        );
      }

      setAdminOrders(
        Array.isArray(data.orders) ? data.orders : []
      );
    } catch (error) {
      console.error("Admin orders error:", error);
      setOrdersError(error.message);
    } finally {
      setOrdersLoading(false);
    }
  };


  // CHANGE SIDEBAR MENU
  const [menuHistory, setMenuHistory] = useState([]);

  
const handleMenuChange = (menu) => {
  if (menu !== activeMenu) {
    setMenuHistory((previous) => [...previous, activeMenu]);
    setActiveMenu(menu);
  }

  // Fetch customer orders when Admin opens Orders
  if (menu === "Orders") {
    fetchAdminOrders();
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
    setMobileMenuOpen(false);
  };

  // LOGOUT
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");

    navigate("/signin", { replace: true });
  };

  // DELETE CUSTOMER OR VENDOR
  const handleDeleteUser = async (userId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this account?"
    );

    if (!confirmed) return;

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/api/admin/users/${userId}`,
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
          data.message || "Unable to delete account."
        );
      }

      setUsers((previous) =>
        previous.filter((item) => item._id !== userId)
      );

      setVendors((previous) =>
        previous.filter((item) => item._id !== userId)
      );

      setProducts((previous) =>
        previous.filter((product) => {
          const vendorId =
            typeof product.createdBy === "object"
              ? product.createdBy?._id
              : product.createdBy;

          return vendorId !== userId;
        })
      );
    } catch (err) {
      alert(err.message);
    }
  };

  // DELETE ANY PRODUCT
  const handleDeleteProduct = async (productId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this product?"
    );

    if (!confirmed) return;

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

      setProducts((previous) =>
        previous.filter(
          (product) => product._id !== productId
        )
      );
    } catch (err) {
      alert(err.message);
    }
  };

  // EDIT PRODUCT
  const handleEditProduct = (product) => {
    setEditingProduct(product);
  };

  // CUSTOMER ACCOUNTS ONLY
  const customers = users.filter(
    (item) => item.role === "customer"
  );

  // UPDATED SIDEBAR MENU
const menuItems = [
  { name: "Dashboard", icon: "bi-grid-1x2-fill" },
  { name: "Customers", icon: "bi-people-fill" },
  { name: "Vendors", icon: "bi-shop" },
  { name: "Products", icon: "bi-bag-fill" },
  { name: "Orders", icon: "bi-receipt" },
  { name: "Send Notification", icon: "bi-bell-fill" },
  { name: "Profile", icon: "bi-person-circle" },
];

  // OVERVIEW STATISTICS
  const overviewCards = [
    {
      title: "Total Customers",
      count: customers.length,
      icon: "bi-people-fill",
      bg: "#eee8ff",
      color: "#8054d6",
    },
    {
      title: "Total Vendors",
      count: vendors.length,
      icon: "bi-shop",
      bg: "#ffe5ef",
      color: "#fc2779",
    },
    {
      title: "Total Products",
      count: products.length,
      icon: "bi-box-seam-fill",
      bg: "#d9f7ef",
      color: "#13a98c",
    },
    {
      title: "Total Revenue",
      count: "Not available",
      icon: "bi-currency-rupee",
      bg: "#fff0dc",
      color: "#ed9634",
    },
  ];

  // DASHBOARD MANAGEMENT CARDS
  const managementCards = [
    {
      title: "Manage Customers",
      description: "View & delete customers",
      icon: "bi-people-fill",
      menu: "Customers",
      bg: "#eee8ff",
      iconBg: "#dfd1ff",
      color: "#8054d6",
    },
    {
      title: "Manage Vendors",
      description: "View & delete vendors",
      icon: "bi-shop",
      menu: "Vendors",
      bg: "#ffe5ef",
      iconBg: "#ffd0e2",
      color: "#fc2779",
    },
    {
      title: "Manage Products",
      description: "Manage all products",
      icon: "bi-box-seam-fill",
      menu: "Products",
      bg: "#d9f7ef",
      iconBg: "#bcefe1",
      color: "#13a98c",
    },
    {
      title: "Manage Orders",
      description: "View customer purchase orders",
      icon: "bi-receipt",
      menu: "Orders",
      bg: "#fff0dc",
      iconBg: "#ffe1bd",
      color: "#ed9634",
    },
  ];

  // REUSABLE NAVIGATION BUTTON
  const renderMenuButton = (item) => (
    <button
      key={item.name}
      type="button"
      onClick={() => handleMenuChange(item.name)}
      className="btn text-start d-flex align-items-center gap-3 w-100"
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
        fontSize: "14px",
        border: "none",
        padding: "12px",
        borderRadius: "8px",
      }}
    >
      <i className={`bi ${item.icon} fs-6`}></i>
      {item.name}
    </button>
  );

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
            onClick={() =>
              setMobileMenuOpen((previous) => !previous)
            }
            aria-label="Toggle navigation"
            aria-expanded={mobileMenuOpen}
            aria-controls="admin-mobile-menu"
          >
            <i
              className={`bi ${
                mobileMenuOpen
                  ? "bi-x-lg"
                  : "bi-list"
              } fs-5`}
            ></i>
          </button>
        </div>

        {/* MOBILE DROPDOWN MENU */}
        {mobileMenuOpen && (
          <nav
            id="admin-mobile-menu"
            className="border-top p-3"
          >
            <div className="d-flex flex-column gap-1">
              {menuItems.map(renderMenuButton)}

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

      {/* SIDEBAR + MAIN CONTENT */}
      <div className="d-flex flex-grow-1">
        {/* DESKTOP SIDEBAR */}
        <aside
          className="d-none d-md-flex bg-white border-end p-3 flex-column flex-shrink-0"
          style={{ width: "230px" }}
        >
          <div className="d-flex align-items-center justify-content-center gap-2 py-3 mb-4">
            <i
              className="bi bi-bag-heart-fill fs-3"
              style={{ color: "#fc2779" }}
            ></i>

            <span className="fw-bold fs-5">
              Nykaa Store
            </span>
          </div>

          <nav className="d-flex flex-column gap-2">
            {menuItems.map(renderMenuButton)}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="btn text-start d-flex align-items-center gap-2 mt-auto"
            style={{
              color: "#dc3545",
              fontSize: "13px",
            }}
          >
            <i className="bi bi-box-arrow-right"></i>
            Logout
          </button>
        </aside>

        {/* MAIN CONTENT */}
        <main
          className="flex-grow-1"
          style={{ minWidth: 0 }}
        >
          {/* ADMIN HEADER */}
          <header className="bg-white border-bottom px-3 px-md-4 py-3">
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
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

                  <h4 className="fw-bold mb-0 fs-5">
                    {activeMenu === "Dashboard"
                      ? "Admin Dashboard"
                      : activeMenu}
                  </h4>
                </div>


                <p className="text-secondary small mb-0">
                  {activeMenu === "Profile"
                    ? "Manage your account and admin invitations."
                    : "Manage users, vendors and products with ease."}
                </p>
              </div>

              {/* ADMIN GREETING */}
              <div className="d-flex align-items-center gap-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                  style={{
                    width: "38px",
                    height: "38px",
                    backgroundColor: "#fc2779",
                  }}
                >
                  {user?.name?.charAt(0)?.toUpperCase() ||
                    "A"}
                </div>

                <span className="fw-semibold small">
                  Hi, {user?.name || "Admin"}
                </span>
              </div>
            </div>
          </header>

          <div className="container-fluid p-3 p-md-4">
            {/* ERROR MESSAGE */}
            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            {/* DASHBOARD */}
            {activeMenu === "Dashboard" && (
              <>
                <div className="mb-4">
                  <h4 className="fw-bold mb-2">
                    Hi, {user?.name || "Admin"}! 👋
                  </h4>

                  <p className="text-secondary small mb-0">
                    Manage your store efficiently.
                  </p>
                </div>

                {/* MANAGEMENT CARDS */}
                <div className="row g-3 mb-4">
                  {managementCards.map((card) => (
                    <div
                      className="col-12 col-sm-6"
                      key={card.title}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleMenuChange(card.menu)
                        }
                        className="w-100 border rounded-3 p-3 p-md-4 text-start d-flex align-items-center gap-3"
                        style={{
                          backgroundColor: card.bg,
                          borderColor: card.iconBg,
                          minHeight: "115px",
                        }}
                      >
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: "48px",
                            height: "48px",
                            backgroundColor: card.iconBg,
                            color: card.color,
                          }}
                        >
                          <i
                            className={`bi ${card.icon} fs-4`}
                          ></i>
                        </div>

                        <div className="flex-grow-1">
                          <h6 className="fw-bold text-dark mb-1">
                            {card.title}
                          </h6>

                          <p className="text-secondary small mb-0">
                            {card.description}
                          </p>
                        </div>

                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: "28px",
                            height: "28px",
                            backgroundColor: "#ffffff",
                            color: card.color,
                          }}
                        >
                          <i className="bi bi-arrow-right"></i>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>

                {/* QUICK OVERVIEW */}
                <div className="bg-white border rounded-3 p-3 p-md-4">
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <h6 className="fw-bold mb-0">
                      Quick Overview
                    </h6>

                    <span
                      className="small fw-semibold"
                      style={{ color: "#fc2779" }}
                    >
                      Store Summary
                    </span>
                  </div>

                  <div className="row g-3">
                    {overviewCards.map((card) => (
                      <div
                        className="col-6 col-lg-3"
                        key={card.title}
                      >
                        <div
                          className="border rounded-3 p-3 h-100"
                          style={{
                            backgroundColor: "#fcfbfd",
                            overflowWrap: "anywhere",
                          }}
                        >
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center mb-2"
                            style={{
                              width: "34px",
                              height: "34px",
                              backgroundColor: card.bg,
                              color: card.color,
                            }}
                          >
                            <i
                              className={`bi ${card.icon}`}
                            ></i>
                          </div>

                          <h5 className="fw-bold mb-1">
                            {loading ? "..." : card.count}
                          </h5>

                          <p className="text-secondary small mb-0">
                            {card.title}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {loading && (
                    <div className="text-center text-secondary small mt-3">
                      Loading dashboard information...
                    </div>
                  )}
                </div>
              </>
            )}

            {/* CUSTOMERS */}
            {activeMenu === "Customers" && (
              <>
                <h5 className="fw-bold mb-3">
                  Manage Customers
                </h5>

                <div className="table-responsive w-100">
                  <UserVendorTable
                    users={customers}
                    loading={loading}
                    onDelete={handleDeleteUser}
                    showStoreName={false}
                  />
                </div>
              </>
            )}

            {/* VENDORS */}
            {activeMenu === "Vendors" && (
              <>
                <h5 className="fw-bold mb-3">
                  Manage Vendors
                </h5>

                <div className="table-responsive w-100">
                  <UserVendorTable
                    users={vendors}
                    loading={loading}
                    onDelete={handleDeleteUser}
                    showStoreName={true}
                  />
                </div>
              </>
            )}

            {/* PRODUCTS */}
            {activeMenu === "Products" && (
              <>
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <h5 className="fw-bold mb-0">
                    Manage Products
                  </h5>

                  <span className="text-secondary small">
                    Total Products: {products.length}
                  </span>
                </div>

                <div className="table-responsive w-100">
                  <ProductTable
                    products={products}
                    loading={loading}
                    showEdit={true}
                    showDelete={true}
                    showAddToCart={false}
                    onEdit={handleEditProduct}
                    onDelete={handleDeleteProduct}
                  />
                </div>
              </>
            )}

            
              {/* CUSTOMER ACTIVITY */}
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
                        onClick={fetchAdminOrders}
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <AdminCustomerActivity
                      customers={customers}
                      orders={adminOrders}
                    />
                  )}
                </>
              )}

            {/* ADMIN NOTIFICATIONS */}
            {activeMenu === "Send Notification" && (
              <AdminNotifications />
            )}



            {/* ADMIN PROFILE */}
            {activeMenu === "Profile" && (
              <ProfileDetails
                user={user}
                role="admin"
                onProfileUpdated={(updatedAdmin) => {
                  const updatedUser = {
                    ...user,
                    ...updatedAdmin,
                  };

                  setUser(updatedUser);

                  localStorage.setItem(
                    "user",
                    JSON.stringify(updatedUser)
                  );

                  window.dispatchEvent(new Event("authUpdated"));
                }}
              />
            )}

          </div>
        </main>
      </div>

      {/* EDIT PRODUCT MODAL */}
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

export default AdminDashboard;
