import { useState } from "react";
import { Link } from "react-router-dom";
import sabkooLogo from "../assets/branding/sabkoo-logo.png";

const API_URL = import.meta.env.VITE_API_URL;

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      setMessage(data.message);
      setEmail("");

    } catch (error) {
      setMessage(
        error.message ||
          "Something went wrong. Please try again."
      );
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
            Forgot Password?
          </h3>

          <p className="text-center text-secondary small mb-4">
            Enter your registered email address.
            We'll send you a password reset link.
          </p>

          <form onSubmit={handleSubmit}>

            {/* Email Address */}
            <div className="mb-3">
              <label
                htmlFor="email"
                className="form-label fw-semibold"
              >
                Email Address
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

            {/* Send Reset Link Button */}
            <button
              type="submit"
              className="btn w-100 text-white fw-semibold py-2 rounded-3"
              style={{ backgroundColor: "#087F80" }}
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>

          </form>

          {/* Response Message */}
          {message && (
            <div
              className="alert alert-info mt-3 mb-0 small"
              role="status"
            >
              {message}
            </div>
          )}

          {/* Sign In Link */}
          <p className="text-center mt-4 mb-0">
            Remember your password?{" "}
            <Link
              to="/signin"
              className="text-decoration-none fw-semibold"
              style={{ color: "#087F80" }}
            >
              Sign In
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;