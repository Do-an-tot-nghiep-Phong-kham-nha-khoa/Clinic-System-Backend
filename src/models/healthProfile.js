const mongoose = require("mongoose");
const healthProfileSchema = new mongoose.Schema({
    patient_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Patient",
        required: true,
        unique: true,
    },
    height: { type: Number }, // in cm
    weight: { type: Number }, // in kg
    bloodType: { type: String, enum: ["A", "B", "AB", "O"] },
    allergies: { type: [String] },
    chronicConditions: { type: [String] }, // Tiền sử bệnh
    medications: { type: [String] }, // Thuốc đang dùng
    emergencyContact: {
        name: { type: String },
        relationship: { type: String },
        phone: { type: String }
    },
    lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true }
);

module.exports = mongoose.model("HealthProfile", healthProfileSchema);