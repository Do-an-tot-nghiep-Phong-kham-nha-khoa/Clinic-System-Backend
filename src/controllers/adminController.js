const mongoose = require("mongoose");
const Admin = require("../models/admin");
const Account = require("../models/account");
const Role = require("../models/role");
const bcrypt = require("bcrypt");
// GET /admins
exports.list = async (req, res) => {
    try {
        const admins = await Admin.find({});
        return res.status(200).json(admins)
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server nội bộ',
            error: error.message
        });
    }
}

// [POST] /admins
exports.create = async (req, res) => {
    try {
        const { name, phone, email, password } = req.body;
        if (!name || !phone || !email || !password) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        const existingAccount = await Account.findOne({ email });
        if (existingAccount) {
            return res.status(400).json({ message: 'Email already in use' });
        }
        const adminRole = await Role.findOne({ name: 'admin' });
        if (!adminRole) {
            return res.status(500).json({ message: 'Admin role not configured in the system' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newAccount = new Account({
            email,
            password: hashedPassword,
            roleId: adminRole._id,
        });
        const savedAccount = await newAccount.save();
        const newAdmin = new Admin({
            accountId: savedAccount._id,
            name,
            phone,
        });
        const savedAdmin = await newAdmin.save();
        return res.status(201).json(savedAdmin);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Lỗi server nội bộ', error: error.message });
    }
}