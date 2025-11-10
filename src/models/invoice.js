const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    created_at: {
        type: Date,
        default: Date.now
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
    healthProfile_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HealthProfile',
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