const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    dosageForm: {
        type: String,
        required: false
    },
    manufacturer: {
        type: String,
        required: false
    },
    unit: {
        type: String,
        required: false
    },
    expiryDate: {
        type: Date,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    },
});

module.exports = mongoose.model('Medicine', medicineSchema);