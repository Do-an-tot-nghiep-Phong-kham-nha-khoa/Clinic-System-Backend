const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
    created_at: {
        type: Date,
        default: Date.now
    },
    totalPrice: {
        type: Number,
        required: false
    },
    healthProfile_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HealthProfile',
        required: true
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