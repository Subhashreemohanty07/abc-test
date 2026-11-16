
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ProfileDetails from "../components/ProfileDetails";
import AddressManager from "../components/AddressManger";
import Orders from "../components/Orders";

const API_URL =
  import.meta.env.VITE_API_URL ;

function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  const navigate = useNavigate();

  // FETCH LOGGED-IN USER PROFILE
  useEffect(() => {
    const controller = new AbortController();

    async function fetchProfile() {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/signin", { replace: true });
          return;
        }

        const response = await fetch(
          `${API_URL}/api/auth/profile`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (controller.signal.aborted) return;

        // INVALID OR EXPIRED TOKEN
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");

          window.dispatchEvent(
            new Event("authUpdated")
          );

          navigate("/signin", { replace: true });
          return;
        }

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load profile."
          );
        }

        const profileUser = data.user;

        // ADMIN REDIRECT
        if (profileUser.role === "admin") {
          navigate("/admin-dashboard?tab=profile", {
            replace: true,
          });
          return;
        }

        // VENDOR REDIRECT
        if (profileUser.role === "vendor") {
          navigate("/vendor-dashboard", {
            replace: true,
          });
          return;
        }

        // CUSTOMER PROFILE
        setUser(profileUser);

      } catch (error) {
        if (error.name !== "AbortError") {
          setMessage(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchProfile();

    return () => controller.abort();
  }, [navigate]);

  // FETCH LOGGED-IN CUSTOMER ORDERS
  
  useEffect(() => {
    if (!user) {
      setOrdersLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchMyOrders() {
      setOrdersLoading(true);
      setOrdersError("");

      try {
        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("Please sign in to view your orders.");
        }

        console.log("Fetching customer orders...");

        const response = await fetch(
          `${API_URL}/api/orders/my`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          }
        );

        console.log("Orders API status:", response.status);

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to fetch your orders."
          );
        }

        if (!controller.signal.aborted) {
          setOrders(
            Array.isArray(data.orders) ? data.orders : []
          );
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Orders fetch error:", error);
          setOrdersError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setOrdersLoading(false);
        }
      }
    }

    fetchMyOrders();

    return () => controller.abort();
  }, [user]);


  // LOGOUT
  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.dispatchEvent(
      new Event("authUpdated")
    );

    navigate("/signin", { replace: true });
  }

  // LOADING
  if (loading) {
    return (
      <div className="container text-center py-5">
        <div
          className="spinner-border"
          style={{ color: "#fc2779" }}
          role="status"
        >
          <span className="visually-hidden">
            Loading...
          </span>
        </div>

        <p className="mt-3 text-secondary">
          Loading your profile...
        </p>
      </div>
    );
  }

  // ERROR
  if (message) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger">
          {message}
        </div>

        <button
          type="button"
          className="btn text-white"
          style={{ backgroundColor: "#fc2779" }}
          onClick={handleLogout}
        >
          Back to Sign In
        </button>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div
      className="min-vh-100 py-4 py-md-5"
      style={{ backgroundColor: "#f8f9fa" }}
    >
      <div className="container">

        {/* PAGE HEADING */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="fw-bold mb-0">
            My Account
          </h3>

          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={handleLogout}
          >
            <i className="bi bi-box-arrow-right me-2"></i>
            Logout
          </button>
        </div>

        {/* CUSTOMER PROFILE DETAILS */}
        <ProfileDetails
          user={user}
          role="customer"
        />

        {/* CUSTOMER SAVED ADDRESSES */}
        <div className="mt-4">
          <AddressManager />
        </div>

        {/* CUSTOMER ORDERS */}
        <div className="mt-4">
          {ordersLoading ? (
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body text-center py-5">
                <div
                  className="spinner-border"
                  style={{ color: "#fc2779" }}
                  role="status"
                >
                  <span className="visually-hidden">
                    Loading orders...
                  </span>
                </div>

                <p className="text-secondary mt-3 mb-0">
                  Loading your orders...
                </p>
              </div>
            </div>
          ) : ordersError ? (
            <div className="alert alert-danger">
              {ordersError}
            </div>
          ) : (
            <Orders
              isAdmin={false}
              isVendor={false}
              orders={orders}
            />
          )}
        </div>

      </div>
    </div>
  );
}

export default Profile;
