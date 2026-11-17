import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Signin from "./pages/Signin";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgetPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminDashboard from "./pages/AdminDashboard";
import VendorDashboard from "./pages/VendorDashboard";
import ProductListing from "./pages/ProductListing";
import ProductDetails from "./pages/ProductDetails";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import CustomerWishlist from "./pages/CustomerWishlist";
import AcceptAdminInvite from "./pages/AcceptAdminInvite";
import ProtectedRoute from "./pages/ProtectedRoute";
import OrderSuccess from "./pages/OrderSuccess";
import ScrollToTop from "./components/ScrollToTop";
import Notifications from "./pages/Notifications";


function RoleBasedHome() {
  const token = localStorage.getItem("token");

  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    user = null;
  }

  if (token && user?.role === "admin") {
    return <Navigate to="/admin-dashboard" replace />;
  }

  if (token && user?.role === "vendor") {
    return <Navigate to="/vendor-dashboard" replace />;
  }

  return <Home />;
}

function App() {
  return (
    <BrowserRouter>
    <ScrollToTop />
      <Routes>
        <Route path="/" element={<RoleBasedHome />} />
        <Route path="/signin" element={<Signin />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forget-password" element={<ForgotPassword/>}/>
        <Route path="/reset-password" element={<ResetPassword/>}/>
        <Route path="/products" element={<ProductListing/>}/>
        <Route path="/products/:id" element={<ProductDetails />} />
        <Route path="/wishlist" element={<CustomerWishlist />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/checkout" element={<Checkout />}/>
        <Route path="/order-success" element={<OrderSuccess />} />
        <Route path="/admin-dashboard" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>}/>
        <Route path="/vendor-dashboard" element={<ProtectedRoute allowedRoles={["vendor"]}><VendorDashboard/></ProtectedRoute>}/>
        <Route path="/profile" element={<Profile />} />
        <Route path="/accept-admin-invite" element={<AcceptAdminInvite />}/>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;