
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
        stock: existingVariant?.stock ?? 0
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
  onChange
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
    <div className="col-12">

      <label className="form-label fw-semibold">
        Variant Inventory *
      </label>

      {variants.length === 0 ? (

        <div className="alert alert-light border">
          Please select at least one size and one colour
          to configure inventory.
        </div>

      ) : (

        <div className="border rounded p-3">

          <p className="small text-secondary">
            Enter available stock for each size and
            colour combination.
          </p>

          <div
            className="table-responsive"
            style={{ maxHeight: "350px", overflowY: "auto" }}
          >

            <table className="table table-bordered align-middle mb-0">

              <thead className="table-light sticky-top">
                <tr>
                  <th>Size</th>
                  <th>Colour</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>

                {variants.map((variant) => (

                  <tr
                    key={JSON.stringify([
                      variant.size,
                      variant.color
                    ])}
                  >

                    {/* Size */}
                    <td className="fw-semibold">
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
                            border: "1px solid #ced4da",
                            flexShrink: 0
                          }}
                        />

                        {variant.color}

                      </div>
                    </td>

                    {/* Stock input */}
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min="0"
                        step="1"
                        required
                        aria-label={`Stock for ${variant.size} ${variant.color}`}
                        value={variant.stock}
                        style={{ minWidth: "80px" }}
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
                    <td>
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
            className="d-flex justify-content-between align-items-center mt-3 p-3 rounded"
            style={{ backgroundColor: "#fff0f6" }}
          >

            <div>
              <div className="fw-semibold">
                Total Available Stock
              </div>

              <small className="text-secondary">
                {variants.length} size-colour combinations
              </small>
            </div>

            <span
              className="fw-bold fs-4"
              style={{ color: "#fc2779" }}
            >
              {totalStock}
            </span>

          </div>

          <small className="text-secondary d-block mt-2">
            Total stock is calculated automatically.
            Enter 0 for unavailable combinations.
          </small>

        </div>

      )}

    </div>
  );
}

export default VariantStockManager;
