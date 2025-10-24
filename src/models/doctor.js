const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialtyId: { type: mongoose.Schema.Types.ObjectId, ref: "Specialty", required: true },
  phone: String,
  email: String,
  password: String,
  experience: Number,
});

module.exports = mongoose.model("Doctor", doctorSchema);
