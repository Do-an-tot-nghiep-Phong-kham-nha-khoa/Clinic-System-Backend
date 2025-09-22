const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dob: { type: Date },
  phone: { type: String, required: true, unique: true },
  email: { type: String, unique: true },
  address: { type: String },
}, {
  timestamps: true
});

module.exports = mongoose.model("Patient", patientSchema);