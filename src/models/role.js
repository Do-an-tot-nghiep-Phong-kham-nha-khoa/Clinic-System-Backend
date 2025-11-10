// models/role.js
const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        unique: true,
        required: true
    }, // ví dụ: 'doctor', 'patient', 'admin'
    description: String,
    permissions: [
        {module: String, actions: [String]}
    ],
    deleted: {
        type: Boolean,
        default: false
    },
    deletedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
