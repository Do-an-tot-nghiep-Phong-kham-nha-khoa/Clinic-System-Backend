// models/account.js
const mongoose = require('mongoose');
const generate = require('../helpers/generate');

const accountSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    roleId: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }], // hỗ trợ nhiều vai trò
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    tokenUser: {
        type: String,
        default: generate.generateRandomString(20)
    },
    status: {
        type: String,
        default: "active"
    },
    deleted: {
        type: Boolean,
        default: false
    },
    deletedAt: Date
}, {
    timestamps: true
});

module.exports = mongoose.model('Account', accountSchema);
