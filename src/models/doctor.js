const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, unique: true },
  name: { type: String, required: true },
  specialtyId: { type: mongoose.Schema.Types.ObjectId, ref: "Specialty", required: true },
  phone: String,
  experience: Number,
  avatar: String,
  
});

module.exports = mongoose.model("Doctor", doctorSchema);
