function ProductTable({
  products = [],
  loading = false,
  onEdit,
  onDelete,
  onAddToCart,
  showEdit = false,
  showDelete = false,
  showAddToCart = false,
}) {
  return (
    <div
      className="card border-0 shadow-sm rounded-4"
      style={{ backgroundColor: "#FFF8F4" }}
    >
      <div className="card-body p-3 p-md-4">

        {loading ? (

          /* Loading State */
          <div className="text-center py-5">
            <div
              className="spinner-border mb-3"
              style={{ color: "#D93620" }}
              role="status"
            >
              <span className="visually-hidden">
                Loading...
              </span>
            </div>

            <p className="text-secondary mb-0">
              Loading products...
            </p>
          </div>

        ) : products.length === 0 ? (

          /* Empty Product State */
          <div className="text-center py-5">

            <div
              className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
              style={{
                width: "75px",
                height: "75px",
                backgroundColor: "#F4DCD3",
                color: "#D93620",
              }}
            >
              <i className="bi bi-box-seam fs-2"></i>
            </div>

            <h5
              className="fw-bold"
              style={{ color: "#083B40" }}
            >
              No Products Available
            </h5>

            <p className="text-secondary small mb-0">
              Products will appear here once available.
            </p>

          </div>

        ) : (

          /* Product Table */
          <div
            className="table-responsive rounded-3"
            style={{
              border: "1px solid #F4DCD3",
              backgroundColor: "#FFFFFF",
            }}
          >
            <table
              className="table table-hover align-middle mb-0"
              style={{ minWidth: "650px" }}
            >

              {/* Table Header */}
              <thead>
                <tr>
                  {[
                    "Product",
                    "Category",
                    "Price",
                    "Stock",
                    "Action",
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className={`py-3 ${
                        heading === "Product"
                          ? "text-start ps-3"
                          : "text-center"
                      }`}
                      style={{
                        backgroundColor: "#FFE8DD",
                        color: "#2D202E",
                        borderBottom: "1px solid #EFC8B9",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody>
                {products.map((product) => (
                  <tr key={product._id}>

                    {/* Product Image and Name */}
                    <td className="py-3 ps-3">
                      <div className="d-flex align-items-center gap-3">

                        {product.images?.[0]?.url ? (
                          <img
                            src={product.images[0].url}
                            alt={product.productName}
                            className="rounded-3 flex-shrink-0"
                            loading="lazy"
                            style={{
                              width: "55px",
                              height: "70px",
                              objectFit: "cover",
                              border: "1px solid #F4DCD3",
                            }}
                          />
                        ) : (
                          <div
                            className="rounded-3 d-flex justify-content-center align-items-center flex-shrink-0"
                            style={{
                              width: "55px",
                              height: "70px",
                              backgroundColor: "#FFF1EB",
                              color: "#D93620",
                            }}
                          >
                            <i className="bi bi-image fs-4"></i>
                          </div>
                        )}

                        <div className="text-start">
                          <div
                            className="fw-semibold text-break"
                            style={{ color: "#083B40" }}
                          >
                            {product.productName}
                          </div>

                          {product.brand && (
                            <small className="text-secondary">
                              {product.brand}
                            </small>
                          )}
                        </div>

                      </div>
                    </td>

                    {/* Category */}
                    <td className="text-center">
                      <span
                        className="rounded-pill px-3 py-1 small text-capitalize"
                        style={{
                          backgroundColor: "#FFF1EB",
                          color: "#D93620",
                        }}
                      >
                        {product.subCategory || product.category}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="text-center">
                      <div
                        className="fw-semibold"
                        style={{ color: "#083B40" }}
                      >
                        ₹{product.discountPrice || product.price}
                      </div>

                      {product.discountPrice > 0 &&
                        product.discountPrice < product.price && (
                          <small className="text-secondary text-decoration-line-through">
                            ₹{product.price}
                          </small>
                        )}
                    </td>

                    {/* Stock Status */}
                    <td className="text-center">
                      <span
                        className={`badge rounded-pill px-3 py-2 ${
                          Number(product.stock) > 0
                            ? "bg-success-subtle text-success"
                            : "bg-danger-subtle text-danger"
                        }`}
                      >
                        <i
                          className={`bi ${
                            Number(product.stock) > 0
                              ? "bi-check-circle"
                              : "bi-exclamation-circle"
                          } me-1`}
                        ></i>

                        {Number(product.stock) > 0
                          ? `${product.stock} in stock`
                          : "Out of stock"}
                      </span>
                    </td>

                    {/* Action Buttons */}
                    <td>
                      <div className="d-flex justify-content-center align-items-center gap-2">

                        {/* Edit Product */}
                        {showEdit && (
                          <button
                            type="button"
                            className="btn btn-sm rounded-3 px-3 py-2"
                            style={{
                              backgroundColor: "#FFF1EB",
                              color: "#D93620",
                              border: "1px solid #EFC8B9",
                            }}
                            title="Edit product"
                            aria-label={`Edit ${product.productName}`}
                            onClick={() => onEdit?.(product)}
                          >
                            <i className="bi bi-pencil-square"></i>
                          </button>
                        )}

                        {/* Delete Product */}
                        {showDelete && (
                          <button
                            type="button"
                            className="btn btn-sm rounded-3 px-3 py-2"
                            style={{
                              backgroundColor: "#FDE8E8",
                              color: "#DC3545",
                              border: "1px solid #F5C2C7",
                            }}
                            title="Delete product"
                            aria-label={`Delete ${product.productName}`}
                            onClick={() => onDelete?.(product._id)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        )}

                        {/* Add to Cart */}
                        {showAddToCart && (
                          <button
                            type="button"
                            className="btn btn-sm text-white rounded-3 px-3 py-2 text-nowrap"
                            style={{
                              backgroundColor: "#D93620",
                            }}
                            disabled={Number(product.stock) <= 0}
                            onClick={() => onAddToCart?.(product)}
                          >
                            <i className="bi bi-bag-plus me-1"></i>
                            Add to Cart
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        )}

      </div>
    </div>
  );
}

export default ProductTable;