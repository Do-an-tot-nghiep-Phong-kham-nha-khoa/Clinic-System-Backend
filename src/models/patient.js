const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, unique: true },
  name: { type: String, required: true },
  dob: { type: Date },
  phone: { type: String, required: true, unique: true },
  address: { type: String },
  gender: { type: String, enum: ["male", "female", "other"] },
  
});

module.exports = mongoose.model("Patient", patientSchema, "patients");