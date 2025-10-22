const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true
    },
    createAt: {
        type: Date,
        required: true
    }
});

module.exports = mongoose.model('Prescription', prescriptionSchema);