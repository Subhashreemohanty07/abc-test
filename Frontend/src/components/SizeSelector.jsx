import { SIZE_GROUPS } from "../constants/productOptions";

function SizeSelector({ selectedSizes = [], onChange }) {
  return (
    <div className="col-12 text-start">
      <label
        className="form-label fw-semibold"
        style={{ color: "#2D202E" }}
      >
        Available Sizes *
      </label>

      {SIZE_GROUPS.map((group) => (
        <div key={group.label} className="mb-3">

          <p className="small text-secondary fw-semibold mb-2">
            {group.label}
          </p>

          <div className="d-flex flex-wrap gap-2">
            {group.sizes.map((size) => {
              const isSelected = selectedSizes.includes(size);

              return (
                <button
                  key={size}
                  type="button"
                  className="btn btn-sm rounded-3 px-3 py-2"
                  aria-pressed={isSelected}
                  style={{
                    background: isSelected
                    ? "linear-gradient(180deg, #E65A20, #D93620)"
                    : "#FFFFFF",
                    color: isSelected
                      ? "#FFFFFF"
                      : "#2D202E",
                    border: isSelected
                      ? "1px solid #D93620"
                      : "1px solid #F4DCD3",
                    fontWeight: isSelected ? "600" : "400",
                    minWidth: "45px",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => {
                    const updatedSizes = isSelected
                      ? selectedSizes.filter(
                          (item) => item !== size
                        )
                      : [...selectedSizes, size];

                    onChange(updatedSizes);
                  }}
                >
                  {size}
                </button>
              );
            })}
          </div>

        </div>
      ))}
    </div>
  );
}

export default SizeSelector;