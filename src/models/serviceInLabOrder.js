const mongoose = require('mongoose');

const serviceInLabOrderSchema = new mongoose.Schema({
    description: {
        type: String,
        required: false
    },
    quantity: {
        type: Number,
        required: true
    },
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true
    },
    labOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LabOrder',
        required: true
    }
});

module.exports = mongoose.model('ServiceInLabOrder', serviceInLabOrderSchema);