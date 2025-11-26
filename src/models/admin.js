const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("Admin", adminSchema);
