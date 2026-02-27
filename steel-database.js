// Sample database of steel section properties.
// In practice, this could be loaded from an external JSON or CSV file.
// All units are implied by the standard (AISC: inches/lbs, IS: mm/cm/kg)
const steelDatabase = [
    {
        standard: "AISC", shape: "W-Shape", designation: "W14X90",
        properties: { Area: "26.5 in²", Depth: "14.0 in", tw: "0.440 in", bf: "14.5 in", tf: "0.710 in", Ix: "999 in⁴", Zx: "157 in³", Iy: "362 in⁴", Zy: "75.6 in³", Weight: "90 lb/ft" }
    },
    {
        standard: "AISC", shape: "W-Shape", designation: "W12X26",
        properties: { Area: "7.65 in²", Depth: "12.2 in", tw: "0.230 in", bf: "6.49 in", tf: "0.380 in", Ix: "204 in⁴", Zx: "37.2 in³", Iy: "17.3 in⁴", Zy: "8.35 in³", Weight: "26 lb/ft" }
    },
    {
        standard: "AISC", shape: "W-Shape", designation: "W8X10",
        properties: { Area: "2.96 in²", Depth: "7.89 in", tw: "0.170 in", bf: "3.94 in", tf: "0.205 in", Ix: "30.8 in⁴", Zx: "8.87 in³", Iy: "2.09 in⁴", Zy: "1.35 in³", Weight: "10 lb/ft" }
    },
    {
        standard: "AISC", shape: "C-Shape", designation: "C10X30",
        properties: { Area: "8.81 in²", Depth: "10.0 in", tw: "0.673 in", bf: "3.03 in", tf: "0.436 in", Ix: "103 in⁴", Zx: "24.0 in³", Iy: "3.94 in⁴", Zy: "2.66 in³", Weight: "30 lb/ft" }
    },
    {
        standard: "IS", shape: "I-Beam", designation: "ISMB 300",
        properties: { Area: "56.26 cm²", Depth: "300 mm", tw: "7.5 mm", bf: "140 mm", tf: "12.4 mm", Ix: "8603.6 cm⁴", Zx: "573.6 cm³", Iy: "453.9 cm⁴", Zy: "64.8 cm³", Weight: "44.2 kg/m" }
    },
    {
        standard: "IS", shape: "I-Beam", designation: "ISMB 400",
        properties: { Area: "78.46 cm²", Depth: "400 mm", tw: "8.9 mm", bf: "140 mm", tf: "16.0 mm", Ix: "20458.4 cm⁴", Zx: "1022.9 cm³", Iy: "622.1 cm⁴", Zy: "88.9 cm³", Weight: "61.6 kg/m" }
    },
    {
        standard: "IS", shape: "Channel", designation: "ISMC 200",
        properties: { Area: "28.21 cm²", Depth: "200 mm", tw: "6.1 mm", bf: "75 mm", tf: "11.4 mm", Ix: "1819.3 cm⁴", Zx: "181.9 cm³", Iy: "140.4 cm⁴", Zy: "26.3 cm³", Weight: "22.1 kg/m" }
    },
    {
        standard: "Eurocode", shape: "IPE", designation: "IPE 300",
        properties: { Area: "53.80 cm²", Depth: "300 mm", tw: "7.1 mm", bf: "150 mm", tf: "10.7 mm", Ix: "8356 cm⁴", Zx: "628 cm³", Iy: "604 cm⁴", Zy: "125 cm³", Weight: "42.2 kg/m" }
    },
    {
        standard: "Eurocode", shape: "HEB", designation: "HEB 200",
        properties: { Area: "78.10 cm²", Depth: "200 mm", tw: "9.0 mm", bf: "200 mm", tf: "15.0 mm", Ix: "5696 cm⁴", Zx: "643 cm³", Iy: "2003 cm⁴", Zy: "306 cm³", Weight: "61.3 kg/m" }
    }
];

// Helper to get unique standards
function getSteelStandards() {
    const standards = new Set(steelDatabase.map(s => s.standard));
    return Array.from(standards);
}

// Helper to get shapes for a standard
function getSteelShapes(standard) {
    const filtered = steelDatabase.filter(s => s.standard === standard);
    const shapes = new Set(filtered.map(s => s.shape));
    return Array.from(shapes);
}

// Helper to get designations
function getSteelDesignations(standard, shape) {
    return steelDatabase
        .filter(s => s.standard === standard && s.shape === shape)
        .map(s => s.designation);
}

// Helper to get properties
function getSteelProperties(designation) {
    const section = steelDatabase.find(s => s.designation === designation);
    return section ? section.properties : null;
}
