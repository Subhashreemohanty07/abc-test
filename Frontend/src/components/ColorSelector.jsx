import { COLOR_OPTIONS } from "../constants/productOptions";

function ColorSelector({ selectedColors = [], onChange }) {

  // Select or deselect a colour
  const handleColorToggle = (colorName) => {
    const updatedColors = selectedColors.includes(colorName)
      ? selectedColors.filter((color) => color !== colorName)
      : [...selectedColors, colorName];

    onChange(updatedColors);
  };

  // Preserve colours from existing products
  const availableColors = [
    ...COLOR_OPTIONS,
    ...selectedColors
      .filter(
        (color) =>
          !COLOR_OPTIONS.some((option) => option.name === color)
      )
      .map((color) => ({
        name: color,
        hex: "#E9ECEF",
      })),
  ];

  return (
    <div className="col-12 text-start">

      <label
        className="form-label fw-semibold"
        style={{ color: "#2D202E" }}
      >
        Available Colours *
      </label>

      <div className="d-flex flex-wrap gap-2">

        {availableColors.map((color) => {
          const isSelected = selectedColors.includes(color.name);

          return (
            <button
              key={color.name}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleColorToggle(color.name)}
              className="btn btn-sm position-relative d-flex flex-column align-items-center justify-content-center gap-2 p-2"
              style={{
                width: "90px",
                minHeight: "80px",
                border: isSelected
                  ? "2px solid #D93620"
                  : "2px solid #F4DCD3",
                backgroundColor: isSelected
                  ? "#FFF1EB"
                  : "#FFFFFF",
                borderRadius: "10px",
                color: "#2D202E",
                transition: "all 0.2s ease",
              }}
            >

              {/* Selected colour indicator */}
              {isSelected && (
                <i
                  className="bi bi-check-circle-fill position-absolute top-0 end-0 me-1 mt-1"
                  style={{
                    color: "#D93620",
                    fontSize: "14px",
                  }}
                ></i>
              )}

              {/* Colour swatch */}
              <span
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  background: color.hex,
                  border: "1px solid #CED4DA",
                  display: "inline-block",
                }}
              />

              {/* Colour name */}
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: isSelected ? "600" : "400",
                }}
              >
                {color.name}
              </span>

            </button>
          );
        })}

      </div>

      {/* Selected colours */}
      <div
        className="small mt-3 rounded-3 p-2"
        style={{
          backgroundColor: "#FFF1EB",
          color: "#2D202E",
        }}
      >
        <span className="fw-semibold">
          Selected Colours:
        </span>{" "}

        {selectedColors.length > 0
          ? selectedColors.join(", ")
          : "None"}
      </div>

    </div>
  );
}

export default ColorSelector;