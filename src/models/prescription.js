const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
    createAt: {
        type: Date,
        required: true
    },
    totalPrice: {
        type: Number,
        required: false
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: false
    },
    items: [{
        medicineId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Medicine',
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        dosage: {
            type: String,
            required: false
        },
        frequency: {
            type: String,
            required: false
        },
        duration: {
            type: String,
            required: false
        },
        instruction: {
            type: String,
            required: false
        }
    }]
});

module.exports = mongoose.model('Prescription', prescriptionSchema);