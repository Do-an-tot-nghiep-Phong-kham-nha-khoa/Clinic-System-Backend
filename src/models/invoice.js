const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true
    },
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
        required: true
    },
    prescriptionId: {
        type: Number,
        required: true
    },
    labOrderId: {
        type: Number,
        required: true
    }
});

module.exports = mongoose.model('Invoice', invoiceSchema);