const mongoose = require('mongoose');

const labOrderSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true
    },
    testTime: {
        type: Date,
        required: true
    },
    totalPrice: {
        type: Number,
        required: true
    }
});

module.exports = mongoose.model('LabOrder', labOrderSchema);