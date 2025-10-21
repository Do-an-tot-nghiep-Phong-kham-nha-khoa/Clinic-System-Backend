const mongoose = require("mongoose");

const familyMemberSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  name: { type: String, required: true },
  relationship: { type: String, required: true }, // vd: "cha", "mẹ", "con"
  dob: { type: Date },
  gender: { type: String, enum: ["male", "female", "other"] },
  phone: { type: String },
});

module.exports = mongoose.model("FamilyMember", familyMemberSchema);
