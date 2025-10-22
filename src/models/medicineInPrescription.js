const mongoose = require('mongoose');

const medicineInPrescriptionSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true
    },
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
        type: Number,
        required: true
    },
    prescriptionId: {
        type: Number,
        required: true
    }
});

module.exports = mongoose.model('MedicineInPrescription', medicineInPrescriptionSchema);