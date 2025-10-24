const mongoose = require("mongoose");

const medicalRecordSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true
  },
  treatments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Treatment"
    }
  ],
  notes: { type: String }, // ghi chú tổng quan
}, {
  timestamps: true // createdAt, updatedAt
});

module.exports = mongoose.model("MedicalRecord", medicalRecordSchema);
