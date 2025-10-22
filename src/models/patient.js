const mongoose = require("mongoose");
const generate = require("../helpers/generate");

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dob: { type: Date },
  phone: { type: String, required: true, unique: true },
  email: { type: String, unique: true },
  password: { type: String, required: true },
  address: { type: String },
  gender: { type: String, enum: ["male", "female", "other"] },
  tokenUser: {
    type: String,
    default: generate.generateRandomString(20)
  },
  status: {
    type: String,
    default: "active"
  },
  deleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model("Patient", patientSchema, "patients");