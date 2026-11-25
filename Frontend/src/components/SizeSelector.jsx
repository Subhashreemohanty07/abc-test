
import { SIZE_GROUPS } from "../constants/productOptions";

function SizeSelector({ selectedSizes = [], onChange }) {
  return (
    <div className="col-12">
      <label className="form-label fw-semibold">
        Available Sizes *
      </label>

      {SIZE_GROUPS.map((group) => (
        <div key={group.label} className="mb-3">

          <p className="small text-secondary fw-semibold mb-2">
            {group.label}
          </p>

          <div className="d-flex flex-wrap gap-2">
            {group.sizes.map((size) => (
              <button
                key={size}
                type="button"
                className="btn btn-sm px-3 py-2"
                aria-pressed={selectedSizes.includes(size)}
                style={{
                  backgroundColor: selectedSizes.includes(size)
                    ? "#fc2779"
                    : "#ffffff",
                  color: selectedSizes.includes(size)
                    ? "#ffffff"
                    : "#333333",
                  border: selectedSizes.includes(size)
                    ? "1px solid #fc2779"
                    : "1px solid #ced4da",
                  minWidth: "45px",
                }}
                onClick={() => {
                  const updatedSizes = selectedSizes.includes(size)
                    ? selectedSizes.filter((item) => item !== size)
                    : [...selectedSizes, size];

                  onChange(updatedSizes);
                }}
              >
                {size}
              </button>
            ))}
          </div>

        </div>
      ))}
    </div>
  );
}

export default SizeSelector;
