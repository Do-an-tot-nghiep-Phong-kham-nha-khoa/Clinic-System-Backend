const mongoose = require("mongoose");

const receptionistSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  password: { type: String, required: true }
});

module.exports = mongoose.model("Receptionist", receptionistSchema);
