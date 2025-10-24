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
    }
});

module.exports = mongoose.model('Prescription', prescriptionSchema);