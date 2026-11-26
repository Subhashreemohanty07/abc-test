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

      // Mobile number is required for both customer and vendor
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

      // Display the backend response
      setMessage(
        data.message ||
          "Registration successful! Please check your email to verify your account."
      );

      // Clear the signup form
      resetForm();

    } catch (error) {
      setMessage(error.message || "Unable to create account.");
    } finally {
      setLoading(false);
    }
  }

  // Reusable Bootstrap input styling
  const inputClass = "form-control rounded-3 py-2";
  const labelClass = "form-label small fw-semibold mb-1";

  return (
    <div
      className="container-fluid min-vh-100 d-flex justify-content-center align-items-center py-4 px-3"
      style={{ backgroundColor: "#EEF8F7" }}
    >
      <div
        className="card border-0 shadow-sm"
        style={{
          maxWidth: role === "vendor" ? "850px" : "600px",
          width: "100%",
          borderRadius: "18px",
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

          {/* Heading */}
          <h3
            className="text-center fw-bold mb-2"
            style={{ color: "#087F80" }}
          >
            Create Account
          </h3>

          <p className="text-center text-secondary small mb-4">
            Join the Sabkoo community
          </p>

          <form onSubmit={handleSubmit}>

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
                value={role}
                onChange={(event) => {
                  setRole(event.target.value);
                  setMessage("");
                }}
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
                  {role === "vendor"
                    ? "Contact Person's Name"
                    : "Full Name"}
                </label>

                <input
                  id="name"
                  type="text"
                  className={inputClass}
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
                  {role === "vendor"
                    ? "Business Email"
                    : "Email Address"}
                </label>

                <input
                  id="signup-email"
                  type="email"
                  className={inputClass}
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  required
                />
              </div>
            </div>

            {/* Mobile Number */}
            <div className="row g-3 mt-0">
              <div
                className={
                  role === "vendor"
                    ? "col-md-6"
                    : "col-12"
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
              {role === "vendor" && (
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

            {/* Vendor-only Fields */}
            {role === "vendor" && (
              <>
                <hr
                  className="my-4"
                  style={{ borderColor: "#087F80" }}
                />

                <h6
                  className="fw-bold mb-3"
                  style={{ color: "#087F80" }}
                >
                  Business Details
                </h6>

                {/* Postal Code */}
                <div className="row g-3">
                  <div className="col-md-12">
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
                    placeholder="Enter your business address"
                    rows="2"
                    value={businessAddress}
                    onChange={(event) =>
                      setBusinessAddress(event.target.value)
                    }
                    required
                  />
                </div>
              </>
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

            {/* Create Account Button */}
            <button
              type="submit"
              className="btn w-100 text-white fw-semibold mt-4 py-2 rounded-3"
              style={{ backgroundColor: "#087F80" }}
              disabled={loading}
            >
              {loading
                ? "Creating account..."
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

export default Signup;