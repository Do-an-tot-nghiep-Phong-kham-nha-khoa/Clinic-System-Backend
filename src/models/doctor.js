const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    address: { type: String },
    expertise: { type: Expertise, required: true }
}, {
    timestamps: true
});

const Expertise = {
    name: { type: String, required: true },
    description: { type: String } 
};

module.exports = mongoose.model("Doctor", doctorSchema, "doctors");