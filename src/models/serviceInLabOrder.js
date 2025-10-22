const mongoose = require('mongoose');

const serviceInLabOrderSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true
    },
    price: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    serviceId: {
        type: Number,
        required: true
    },
    labOrderId: {
        type: Number,
        required: true
    }
});

module.exports = mongoose.model('ServiceInLabOrder', serviceInLabOrderSchema);