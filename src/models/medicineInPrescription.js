const mongoose = require('mongoose');

const medicineInPrescriptionSchema = new mongoose.Schema({
    quantity: {
        type: Number,
        required: true
    },
    dosage: {
        type: String,
        required: true
    },
    frequency: {
        type: String,
        required: true
    },
    duration: {
        type: String,
        required: true
    },
    instruction: {
        type: String,
        required: true
    },
    medicineId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine',
        required: true
    },
    prescriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prescription',
        required: true
    }
});

module.exports = mongoose.model('MedicineInPrescription', medicineInPrescriptionSchema);