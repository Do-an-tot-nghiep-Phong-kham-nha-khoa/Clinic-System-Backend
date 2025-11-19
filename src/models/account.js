// models/account.js
const mongoose = require('mongoose');
const generate = require('../helpers/generate');

const accountSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' }, 
    status: {
        type: String,
        default: "active"
    },
    avatar: {type: String, default: ""},
    deleted: {
        type: Boolean,
        default: false
    },
    deletedAt: Date
}, {
    timestamps: true
});

module.exports = mongoose.model('Account', accountSchema);
