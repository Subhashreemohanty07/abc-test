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
        hex: "#E9ECEF"
      }))
  ];

  return (
    <div className="col-12">

      <label className="form-label fw-semibold">
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
              className="btn btn-sm d-flex flex-column align-items-center justify-content-center gap-2 p-2"
              style={{
                width: "90px",
                minHeight: "80px",
                border: isSelected
                  ? "2px solid #fc2779"
                  : "2px solid #dee2e6",
                backgroundColor: isSelected
                  ? "#fff0f6"
                  : "#ffffff",
                borderRadius: "8px",
                color: "#333333"
              }}
            >

              {/* Colour swatch */}
              <span
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  background: color.hex,
                  border: "1px solid #ced4da",
                  display: "inline-block"
                }}
              />

              {/* Colour name */}
              <span style={{ fontSize: "12px" }}>
                {color.name}
              </span>

            </button>
          );
        })}

      </div>

      {/* Selected colours */}
      <div className="small text-secondary mt-2">
        Selected Colours:{" "}
        {selectedColors.length > 0
          ? selectedColors.join(", ")
          : "None"}
      </div>

    </div>
  );
}

export default ColorSelector;
