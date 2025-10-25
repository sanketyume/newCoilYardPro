/**
 * Parses a complex barcode string to extract the core coil ID.
 * 
 * Complex barcode format: "24AC40001 3.6X1250X1500 23.6"
 * Simple coil ID format: "24AC40001"
 * 
 * @param {string} barcodeString - The barcode string to parse
 * @returns {string} The extracted coil ID
 */
export const getCoilIdFromBarcode = (barcodeString) => {
  if (!barcodeString) return '';
  
  const trimmed = barcodeString.trim();
  
  // If the barcode contains spaces, it's a complex barcode - extract the first part
  if (trimmed.includes(' ')) {
    const parts = trimmed.split(/\s+/);
    return parts[0]; // Return the coil ID (first part)
  }
  
  // Otherwise, it's already a simple coil ID - return as-is
  return trimmed;
};

/**
 * Parses a complex barcode to extract all components.
 * 
 * Format: "24AC40001 3.6X1250X1500 23.6"
 * Returns: { coilId, thickness, width, diameter, weight }
 * 
 * @param {string} barcodeString - The full barcode string
 * @returns {object|null} Parsed barcode components or null if invalid
 */
export const parseComplexBarcode = (barcodeString) => {
  if (!barcodeString) return null;
  
  const parts = barcodeString.trim().split(/\s+/);
  if (parts.length < 2) return null;

  const coilId = parts[0];
  const weight = parseFloat(parts[parts.length - 1]);
  if (isNaN(weight)) return null;

  const dimensionsPart = parts.find(p => p.includes('X'));
  let thickness = null, width = null, diameter = null;
  
  if (dimensionsPart) {
    const dims = dimensionsPart.split('X').map(d => parseFloat(d));
    if (dims.length === 3 && dims.every(d => !isNaN(d))) {
      [thickness, width, diameter] = dims;
    }
  }

  return {
    coilId,
    thickness,
    width,
    diameter,
    weight,
  };
};