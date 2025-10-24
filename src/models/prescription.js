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
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MedicineInPrescription'
    }]
});

module.exports = mongoose.model('Prescription', prescriptionSchema);