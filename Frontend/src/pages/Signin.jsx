import { useState } from "react";
import { signinUser } from "../services/authService";
import { Link, useNavigate, useLocation } from "react-router-dom";
import sabkooLogo from "../assets/branding/sabkoo-logo.png";

function Signin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from;

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const data = await signinUser(email, password);

      // Save the JWT token in the browser
      localStorage.setItem("token", data.token);

      // Save the user's details in the browser
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect customer back to checkout after signing in
      if (
        data.user.role === "customer" &&
        redirectTo === "/checkout"
      ) {
        navigate("/checkout", { replace: true });
        return;
      }

      // Normal role-based navigation
      if (data.user.role === "admin") {
        navigate("/admin-dashboard", { replace: true });
      } else if (data.user.role === "vendor") {
        navigate("/vendor-dashboard", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="container-fluid min-vh-100 d-flex justify-content-center align-items-center py-4 px-3"
      style={{ backgroundColor: "#EEF8F7" }}
    >
      <div
        className="card shadow-sm border-0 p-3 p-md-4"
        style={{
          maxWidth: "440px",
          width: "100%",
          borderRadius: "18px",
        }}
      >
        <div className="card-body">

          {/* Logo */}
          <div className="text-center mb-3">
            <img
              src={sabkooLogo}
              alt="Sabkoo"
              style={{
                width: "220px",
                maxWidth: "100%",
                height: "auto",
              }}
            />
          </div>

          {/* Heading */}
          <h3
            className="text-center fw-bold mb-2"
            style={{ color: "#087F80" }}
          >
            Welcome Back!
          </h3>

          <p className="text-center text-secondary mb-4">
            Sign in to continue
          </p>

          <form onSubmit={handleSubmit}>

            {/* Email */}
            <div className="mb-3">
              <label
                htmlFor="email"
                className="form-label fw-semibold"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                className="form-control rounded-3 py-2"
                placeholder="Enter your email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
              />
            </div>

            {/* Password */}
            <div className="mb-3">
              <label
                htmlFor="password"
                className="form-label fw-semibold"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                className="form-control rounded-3 py-2"
                placeholder="Enter your password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
              />
            </div>

            {/* Forgot Password Link */}
            <div className="text-end mb-3">
              <Link
                to="/forget-password"
                className="text-decoration-none small fw-semibold"
                style={{ color: "#087F80" }}
              >
                Forgot Password?
              </Link>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              className="btn w-100 text-white fw-semibold py-2 rounded-3"
              style={{ backgroundColor: "#087F80" }}
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Message */}
          {message && (
            <div
              className="alert alert-info mt-3 mb-0"
              role="status"
            >
              {message}
            </div>
          )}

          {/* Sign Up Link */}
          <p className="text-center mt-4 mb-0">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="text-decoration-none fw-semibold"
              style={{ color: "#087F80" }}
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signin;