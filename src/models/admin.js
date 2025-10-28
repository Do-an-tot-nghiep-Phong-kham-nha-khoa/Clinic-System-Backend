const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, unique: true },
  name: { type: String, required: true },
  username: { type: String, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "admin" }
});

module.exports = mongoose.model("Admin", adminSchema);
