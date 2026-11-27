function StoreProfile({ vendor }) {
  if (!vendor) {
    return (
      <div
        className="alert border-0 rounded-3"
        style={{
          backgroundColor: "#FFF1EB",
          color: "#D93620",
        }}
      >
        Store details not available.
      </div>
    );
  }

  const details = vendor.vendorDetails || {};

  const fields = [
    {
      label: "Store Name",
      value: details.storeName,
      icon: "bi-shop",
    },
    {
      label: "Contact Person",
      value: vendor.name,
      icon: "bi-person",
    },
    {
      label: "Business Email",
      value: vendor.email,
      icon: "bi-envelope",
    },
    {
      label: "Mobile Number",
      value: vendor.mobile,
      icon: "bi-telephone",
    },
    {
      label: "Business Address",
      value: details.businessAddress,
      icon: "bi-geo-alt",
    },
    {
      label: "City",
      value: details.city,
      icon: "bi-building",
    },
    {
      label: "State",
      value: details.state,
      icon: "bi-map",
    },
    {
      label: "Postal Code",
      value: details.postalCode,
      icon: "bi-mailbox",
    },
  ];

  return (
    <div className="container-fluid px-0 text-start">
      <div
        className="card rounded-4 overflow-hidden"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #F4DCD3",
          boxShadow: "0 5px 15px rgba(190,75,45,0.08)",
        }}
      >

        {/* STORE PROFILE HEADER */}
        <div
          className="p-3 p-md-4"
          style={{
            background: "linear-gradient(135deg, #FFF1EB, #FFE2D5)",
            borderBottom: "1px solid #F4DCD3",
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-3 p-3 text-white flex-shrink-0"
              style={{
                background: "linear-gradient(180deg, #E65A20, #D93620)",
                boxShadow: "0 4px 10px rgba(217,54,32,0.18)",
              }}
            >
              <i className="bi bi-shop fs-3"></i>
            </div>

            <div>
              <h4
                className="fw-bold mb-1"
                style={{ color: "#2D202E" }}
              >
                Store Profile
              </h4>

              <p className="text-secondary small mb-0">
                Your registered business information
              </p>
            </div>
          </div>
        </div>

        {/* STORE INFORMATION */}
        <div
          className="card-body p-3 p-md-4"
          style={{ backgroundColor: "#FFF8F4" }}
        >
          <h5
            className="fw-bold mb-1"
            style={{ color: "#2D202E" }}
          >
            Business Details
          </h5>

          <p className="text-secondary small mb-4">
            View your registered store and contact details.
          </p>

          <div className="row g-3">
            {fields.map((field) => (
              <div
                className="col-12 col-md-6 col-xl-4"
                key={field.label}
              >
                <div
                  className="d-flex align-items-start gap-3 rounded-4 p-3 h-100"
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #F4DCD3",
                    boxShadow: "0 3px 8px rgba(190,75,45,0.04)",
                  }}
                >
                  {/* FIELD ICON */}
                  <div
                    className="rounded-3 d-flex justify-content-center align-items-center flex-shrink-0"
                    style={{
                      width: "42px",
                      height: "42px",
                      backgroundColor: "#FFE8DD",
                      color: "#D93620",
                    }}
                  >
                    <i className={`bi ${field.icon} fs-5`}></i>
                  </div>

                  {/* FIELD INFORMATION */}
                  <div className="overflow-hidden">
                    <small className="text-secondary">
                      {field.label}
                    </small>

                    <div
                      className="fw-semibold text-break mt-1"
                      style={{ color: "#2D202E" }}
                    >
                      {field.value || "Not provided"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}

export default StoreProfile;