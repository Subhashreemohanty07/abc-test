import { COLOR_OPTIONS } from "../constants/productOptions";

// Generate size and colour combinations
export const generateVariants = (
  sizes = [],
  colors = [],
  existingVariants = []
) => {
  return sizes.flatMap((size) =>
    colors.map((color) => {
      // Preserve existing stock for matching combinations
      const existingVariant = existingVariants.find(
        (variant) =>
          variant.size === size &&
          variant.color === color
      );

      return {
        size,
        color,
        stock: existingVariant?.stock ?? 0,
      };
    })
  );
};

// Calculate total product stock
export const calculateTotalStock = (variants = []) => {
  return variants.reduce(
    (total, variant) => total + Number(variant.stock || 0),
    0
  );
};

function VariantStockManager({
  variants = [],
  onChange,
}) {

  // Update stock for a specific size-colour combination
  const handleStockChange = (size, color, value) => {
    const stock = value === "" ? "" : Number(value);

    // Prevent negative and decimal quantities
    if (
      stock !== "" &&
      (!Number.isSafeInteger(stock) || stock < 0)
    ) {
      return;
    }

    const updatedVariants = variants.map((variant) =>
      variant.size === size &&
      variant.color === color
        ? { ...variant, stock }
        : variant
    );

    onChange(updatedVariants);
  };

  // Get colour swatch
  const getColorHex = (colorName) => {
    return (
      COLOR_OPTIONS.find(
        (color) => color.name === colorName
      )?.hex || "#E9ECEF"
    );
  };

  const totalStock = calculateTotalStock(variants);

  return (
    <div className="col-12 text-start">

      <label
        className="form-label fw-semibold"
        style={{ color: "#2D202E" }}
      >
        Variant Inventory *
      </label>

      {variants.length === 0 ? (

        <div
          className="rounded-3 p-3"
          style={{
            backgroundColor: "#FFF1EB",
            border: "1px solid #F4DCD3",
            color: "#2D202E",
          }}
        >
          <i className="bi bi-info-circle me-2"></i>

          Please select at least one size and one colour
          to configure inventory.
        </div>

      ) : (

        <div
          className="rounded-3 p-2 p-md-3"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #FFF1EB",
          }}
        >

          <p className="small text-secondary mb-3">
            Enter available stock for each size and
            colour combination.
          </p>

          <div
            className="table-responsive rounded-3"
            style={{
              maxHeight: "350px",
              overflowY: "auto",
              border: "1px solid #FFF1EB",
            }}
          >

            <table
              className="table table-bordered align-middle mb-0"
              style={{ minWidth: "400px" }}
            >

              <thead className="sticky-top">
                <tr>
                  {["Size", "Colour", "Stock", "Status"].map(
                    (heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="text-center py-3"
                        style={{
                          backgroundColor: "#FFF1EB",
                          color: "#2D202E",
                        }}
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>

                {variants.map((variant) => (

                  <tr
                    key={JSON.stringify([
                      variant.size,
                      variant.color,
                    ])}
                  >

                    {/* Size */}
                    <td
                      className="fw-semibold text-center"
                      style={{ color: "#2D202E" }}
                    >
                      {variant.size}
                    </td>

                    {/* Colour */}
                    <td>
                      <div className="d-flex align-items-center gap-2">

                        <span
                          style={{
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            background: getColorHex(
                              variant.color
                            ),
                            border: "1px solid #CED4DA",
                            flexShrink: 0,
                          }}
                        />

                        {variant.color}

                      </div>
                    </td>

                    {/* Stock input */}
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm rounded-2"
                        min="0"
                        step="1"
                        required
                        aria-label={`Stock for ${variant.size} ${variant.color}`}
                        value={variant.stock}
                        style={{
                          minWidth: "80px",
                          borderColor: "#FFF1EB",
                        }}
                        onChange={(e) =>
                          handleStockChange(
                            variant.size,
                            variant.color,
                            e.target.value
                          )
                        }
                      />
                    </td>

                    {/* Stock status */}
                    <td className="text-center">
                      {variant.stock === "" ? (
                        <span className="badge bg-warning text-dark">
                          Enter Stock
                        </span>
                      ) : variant.stock > 0 ? (
                        <span className="badge bg-success">
                          In Stock
                        </span>
                      ) : (
                        <span className="badge bg-danger">
                          Out of Stock
                        </span>
                      )}
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

          {/* Total stock */}
          <div
            className="d-flex justify-content-between align-items-center gap-3 mt-3 p-3 rounded-3"
            style={{
              backgroundColor: "#FFF1EB",
              border: "1px solid #F4DCD3",
            }}
          >

            <div>
              <div
                className="fw-semibold"
                style={{ color: "#2D202E" }}
              >
                <i className="bi bi-boxes me-2"></i>
                Total Available Stock
              </div>

              <small className="text-secondary">
                {variants.length} size-colour combinations
              </small>
            </div>

            <span
              className="fw-bold fs-3"
              style={{ color: "#D93620" }}
            >
              {totalStock}
            </span>

          </div>

          <small className="text-secondary d-block mt-3">
            <i className="bi bi-info-circle me-1"></i>

            Total stock is calculated automatically.
            Enter 0 for unavailable combinations.
          </small>

        </div>

      )}

    </div>
  );
}

export default VariantStockManager;