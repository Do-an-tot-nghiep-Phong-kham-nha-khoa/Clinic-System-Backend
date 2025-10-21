const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialtyId: { type: mongoose.Schema.Types.ObjectId, ref: "Specialty", required: true },
  phone: String,
  email: String,
  password: String,
  experience: Number,
  schedule: [
    {
      day: String, // "Monday", "Tuesday", ...
      timeSlots: [String] // ["08:00-09:00", "09:00-10:00", ...]
    }
  ]
});

module.exports = mongoose.model("Doctor", doctorSchema);
