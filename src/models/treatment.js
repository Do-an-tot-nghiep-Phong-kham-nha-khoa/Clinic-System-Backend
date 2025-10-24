const mongoose = require("mongoose");

const treatmentSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
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
        ref: 'LabOrder',
        required: true
    },
    prescription: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prescription'
    }],
    totalCost: { type: Number, required: true },
}, {
    timestamps: true
});

module.exports = mongoose.model("Treatment", treatmentSchema, "treatments");