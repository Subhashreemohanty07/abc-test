import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import sabkooLogo from "../assets/branding/sabkoo-logo.png";

const API_URL = import.meta.env.VITE_API_URL;

function ResetPassword() {
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (!token || !email) {
      setMessage("Invalid or missing password reset link.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/auth/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            token,
            newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      setMessage(data.message);
      setSuccess(true);
      setNewPassword("");
      setConfirmPassword("");

    } catch (error) {
      setMessage(error.message || "Unable to reset password.");
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
            Reset Password
          </h3>

          <p className="text-center text-secondary small mb-4">
            {success
              ? "Your password has been updated successfully."
              : "Enter your new password below."}
          </p>

          {!success && (
            <form onSubmit={handleSubmit}>

              {/* New Password */}
              <div className="mb-3">
                <label
                  htmlFor="newPassword"
                  className="form-label fw-semibold"
                >
                  New Password
                </label>

                <input
                  id="newPassword"
                  type="password"
                  className="form-control rounded-3 py-2"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(event.target.value)
                  }
                  minLength={8}
                  autoComplete="new-password"
                  required
                />

                <small className="text-secondary">
                  Password must contain at least 8 characters.
                </small>
              </div>

              {/* Confirm Password */}
              <div className="mb-3">
                <label
                  htmlFor="confirmPassword"
                  className="form-label fw-semibold"
                >
                  Confirm New Password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  className="form-control rounded-3 py-2"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </div>

              {/* Reset Password Button */}
              <button
                type="submit"
                className="btn w-100 text-white fw-semibold py-2 rounded-3"
                style={{ backgroundColor: "#087F80" }}
                disabled={loading}
              >
                {loading ? "Updating..." : "Reset Password"}
              </button>

            </form>
          )}

          {/* Success or Error Message */}
          {message && (
            <div
              className={`alert ${
                success ? "alert-success" : "alert-danger"
              } mt-3 mb-0 small`}
              role="status"
            >
              {message}
            </div>
          )}

          {/* Go to Sign In */}
          {success && (
            <Link
              to="/signin"
              className="btn w-100 text-white fw-semibold mt-3 py-2 rounded-3"
              style={{ backgroundColor: "#087F80" }}
            >
              Go to Sign In
            </Link>
          )}

          {/* Back to Sign In */}
          {!success && (
            <p className="text-center mt-4 mb-0">
              <Link
                to="/signin"
                className="text-decoration-none fw-semibold small"
                style={{ color: "#087F80" }}
              >
                <i className="bi bi-arrow-left me-2" />
                Back to Sign In
              </Link>
            </p>
          )}

        </div>
      </div>
    </div>
  );
}

export default ResetPassword;