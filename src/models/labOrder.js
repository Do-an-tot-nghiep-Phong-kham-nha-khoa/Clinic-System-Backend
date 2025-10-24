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
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceInLabOrder'
    }]
});

module.exports = mongoose.model('LabOrder', labOrderSchema);