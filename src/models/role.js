// models/role.js
const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        unique: true,
        required: true
    }, // ví dụ: 'doctor', 'patient', 'admin'
    description: String,
    permissions: [String] // liệt kê các quyền cụ thể: ['create_appointment', 'view_patient', 'manage_doctor']
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
