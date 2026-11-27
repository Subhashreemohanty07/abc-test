
import { useState } from "react";
import { signupUser } from "../services/authService";
import { Link } from "react-router-dom";
import sabkooLogo from "../assets/branding/sabkoo-logo.png";

function Signup() {
  // Common fields
  const [role, setRole] = useState("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");

  // Vendor fields
  const [storeName, setStoreName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Status
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Identify selected account type
  const isVendor = role === "vendor";

  // Dynamic colour theme
  const theme = {
    primary: isVendor ? "#D93620" : "#087F80",

    background: isVendor ? "#FFF1EB" : "#EEF8F7",

    lightBackground: isVendor ? "#FFF5F0" : "#F0F9F8",

    border: isVendor ? "#F4D0C5" : "#D5EAE8",

    button: isVendor
      ? "linear-gradient(180deg, #E65A20 0%, #D93620 100%)"
      : "#087F80",

    shadow: isVendor
      ? "0 8px 30px rgba(190, 75, 45, 0.10)"
      : "0 8px 30px rgba(8, 127, 128, 0.10)",

    buttonShadow: isVendor
      ? "0 4px 12px rgba(217, 54, 32, 0.20)"
      : "0 4px 12px rgba(8, 127, 128, 0.20)",
  };

  // Reset form after successful signup
  function resetForm() {
    setRole("customer");
    setName("");
    setEmail("");
    setMobile("");
    setPassword("");
    setStoreName("");
    setBusinessAddress("");
    setCity("");
    setState("");
    setPostalCode("");
  }

  // Submit form
  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    setMessage("");
    setLoading(true);

    try {
      // Common fields for every account type
      const formData = {
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      };

      // Mobile number for customer and vendor
      formData.mobile = mobile.trim();

      // Add business details only for vendors
      if (role === "vendor") {
        Object.assign(formData, {
          storeName: storeName.trim(),
          businessAddress: businessAddress.trim(),
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
        });
      }

      const data = await signupUser(formData);

      // Display backend response
      setMessage(
        data.message ||
          "Registration successful! Please check your email to verify your account."
      );

      // Clear signup form
      resetForm();

    } catch (error) {
      setMessage(
        error.message || "Unable to create account."
      );
    } finally {
      setLoading(false);
    }
  }

  // Reusable Bootstrap styling
  const inputClass = "form-control rounded-3 py-2";

  const labelClass = "form-label small fw-semibold mb-1";

  const inputStyle = {
    borderColor: theme.border,
    transition: "border-color 0.3s ease",
  };

  return (
    <div
      className="container-fluid min-vh-100 d-flex justify-content-center align-items-center py-4 px-3"
      style={{
        backgroundColor: theme.background,
        transition: "background-color 0.3s ease",
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: isVendor ? "850px" : "600px",
          width: "100%",
          borderRadius: "18px",
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadow,
          transition: "all 0.3s ease",
        }}
      >
        <div className="card-body p-3 p-md-4">

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

          {/* Dynamic Heading */}
          <h3
            className="text-center fw-bold mb-2"
            style={{
              color: theme.primary,
              transition: "color 0.3s ease",
            }}
          >
            {isVendor
              ? "Become a Seller"
              : "Create Account"}
          </h3>

          {/* Dynamic Subtitle */}
          <p className="text-center text-secondary small mb-4">
            {isVendor
              ? "Grow your business with Sabkoo"
              : "Join the Sabkoo community"}
          </p>

          <form onSubmit={handleSubmit} className="text-start">

            {/* Account Type */}
            <div className="mb-3">
              <label
                htmlFor="role"
                className={labelClass}
              >
                Account Type
              </label>

              <select
                id="role"
                className="form-select rounded-3 py-2"
                style={{
                  backgroundColor: theme.lightBackground,
                  borderColor: theme.border,
                  color: theme.primary,
                  fontWeight: "600",
                  transition: "all 0.3s ease",
                }}
                value={role}
                onChange={(event) => {
                  setRole(event.target.value);
                  setMessage("");
                }}
                disabled={loading}
                required
              >
                <option value="customer">Customer</option>
                <option value="vendor">Vendor</option>
              </select>
            </div>

            {/* Name and Email */}
            <div className="row g-3">

              <div className="col-md-6">
                <label
                  htmlFor="name"
                  className={labelClass}
                >
                  {isVendor
                    ? "Contact Person's Name"
                    : "Full Name"}
                </label>

                <input
                  id="name"
                  type="text"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Enter your name"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  required
                />
              </div>

              <div className="col-md-6">
                <label
                  htmlFor="signup-email"
                  className={labelClass}
                >
                  {isVendor
                    ? "Business Email"
                    : "Email Address"}
                </label>

                <input
                  id="signup-email"
                  type="email"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  required
                />
              </div>

            </div>

            {/* Mobile Number and Store Name */}
            <div className="row g-3 mt-0">

              <div
                className={
                  isVendor ? "col-md-6" : "col-12"
                }
              >
                <label
                  htmlFor="mobile"
                  className={labelClass}
                >
                  Mobile Number
                </label>

                <input
                  id="mobile"
                  type="tel"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Enter 10-digit mobile number"
                  value={mobile}
                  onChange={(event) =>
                    setMobile(event.target.value)
                  }
                  pattern="[0-9]{10}"
                  maxLength={10}
                  title="Enter a 10-digit mobile number"
                  required
                />
              </div>

              {/* Vendor Store Name */}
              {isVendor && (
                <div className="col-md-6">
                  <label
                    htmlFor="storeName"
                    className={labelClass}
                  >
                    Store Name
                  </label>

                  <input
                    id="storeName"
                    type="text"
                    className={inputClass}
                    style={inputStyle}
                    placeholder="Enter your store name"
                    value={storeName}
                    onChange={(event) =>
                      setStoreName(event.target.value)
                    }
                    required
                  />
                </div>
              )}

            </div>

            {/* Vendor-only Business Details */}
            {isVendor && (
              <div
                className="rounded-4 p-3 p-md-4 mt-4"
                style={{
                  backgroundColor: theme.lightBackground,
                  border: `1px solid ${theme.border}`,
                }}
              >

                {/* Business Details Header */}
                <div className="d-flex align-items-center gap-3 mb-4">

                  <div
                    className="d-flex align-items-center justify-content-center rounded-3 text-white flex-shrink-0"
                    style={{
                      width: "44px",
                      height: "44px",
                      background: theme.button,
                    }}
                  >
                    <i className="bi bi-shop fs-5"></i>
                  </div>

                  <div>
                    <h6
                      className="fw-bold mb-1"
                      style={{ color: theme.primary }}
                    >
                      Business Details
                    </h6>

                    <p className="small text-secondary mb-0">
                      Enter your registered business information
                    </p>
                  </div>

                </div>

                {/* Postal Code */}
                <div className="row g-3">

                  <div className="col-12">
                    <label
                      htmlFor="postalCode"
                      className={labelClass}
                    >
                      Postal Code
                    </label>

                    <input
                      id="postalCode"
                      type="text"
                      className={inputClass}
                      style={inputStyle}
                      placeholder="Enter postal code"
                      value={postalCode}
                      onChange={(event) =>
                        setPostalCode(event.target.value)
                      }
                      required
                    />
                  </div>

                </div>

                {/* City and State */}
                <div className="row g-3 mt-0">

                  <div className="col-md-6">
                    <label
                      htmlFor="city"
                      className={labelClass}
                    >
                      City
                    </label>

                    <input
                      id="city"
                      type="text"
                      className={inputClass}
                      style={inputStyle}
                      placeholder="Enter city"
                      value={city}
                      onChange={(event) =>
                        setCity(event.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label
                      htmlFor="state"
                      className={labelClass}
                    >
                      State
                    </label>

                    <input
                      id="state"
                      type="text"
                      className={inputClass}
                      style={inputStyle}
                      placeholder="Enter state"
                      value={state}
                      onChange={(event) =>
                        setState(event.target.value)
                      }
                      required
                    />
                  </div>

                </div>

                {/* Business Address */}
                <div className="mt-3">
                  <label
                    htmlFor="businessAddress"
                    className={labelClass}
                  >
                    Business Address
                  </label>

                  <textarea
                    id="businessAddress"
                    className={inputClass}
                    style={inputStyle}
                    placeholder="Enter your business address"
                    rows="2"
                    value={businessAddress}
                    onChange={(event) =>
                      setBusinessAddress(event.target.value)
                    }
                    required
                  />
                </div>

              </div>
            )}

            {/* Password */}
            <div className="mt-3">
              <label
                htmlFor="signup-password"
                className={labelClass}
              >
                Password
              </label>

              <input
                id="signup-password"
                type="password"
                className={inputClass}
                style={inputStyle}
                placeholder="Create your password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                minLength={8}
                autoComplete="new-password"
                required
              />

              <small className="text-secondary">
                Password must contain at least 8 characters.
              </small>
            </div>

            {/* Dynamic Create Account Button */}
            <button
              type="submit"
              className="btn w-100 text-white fw-semibold mt-4 py-3 rounded-3"
              style={{
                background: theme.button,
                border: "none",
                boxShadow: theme.buttonShadow,
                transition: "all 0.3s ease",
              }}
              disabled={loading}
            >
              {loading
                ? "Creating account..."
                : isVendor
                  ? "Register as Seller"
                  : "Create Account"}
            </button>

          </form>

          {/* Message */}
          {message && (
            <div
              className="alert alert-info mt-3 mb-0 py-2 small"
              role="status"
            >
              {message}
            </div>
          )}

          {/* Sign In Link */}
          <p className="text-center small mt-4 mb-0">
            Already have an account?{" "}

            <Link
              to="/signin"
              className="text-decoration-none fw-semibold"
              style={{
                color: theme.primary,
                transition: "color 0.3s ease",
              }}
            >
              Sign In
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}

export default Signup;
