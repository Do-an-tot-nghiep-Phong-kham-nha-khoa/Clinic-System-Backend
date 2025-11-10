const mongoose = require("mongoose");

const treatmentSchema = new mongoose.Schema({
    healthProfile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HealthProfile',
        required: true
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true
    },
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment'
    },
    treatmentDate: { type: Date, required: true },
    diagnosis: { type: String, required: true },
    laborder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LabOrder'
    },
    prescription: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prescription'
    },
    bloodPressure: { type: String },
    heartRate: { type: Number },
    temperature: { type: Number },
    symptoms: { type: String },
    totalCost: { type: Number, required: true },
}, {
    timestamps: true
});

module.exports = mongoose.model("Treatment", treatmentSchema, "treatments");