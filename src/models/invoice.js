const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    createAt: {
        type: Date,
        required: true
    },
    totalPrice: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Paid', 'Cancelled', 'Pending', 'Refunded'],
        default: 'Pending',
        required: true
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    prescriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prescription',
        required: false
    },
    labOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LabOrder',
        required: false
    }
});

module.exports = mongoose.model('Invoice', invoiceSchema);