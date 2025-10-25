const mongoose = require('mongoose');

const labOrderSchema = new mongoose.Schema({
    testTime: {
        type: Date,
        required: true
    },
    totalPrice: {
        type: Number,
        required: true
    },
    items: [{
        serviceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Service',
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        description: {
            type: String,
            required: false
        }
    }]
});

module.exports = mongoose.model('LabOrder', labOrderSchema);