const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Receptionist = require("../models/receptionist");
const Account = require("../models/account");
const Role = require("../models/role");

// [GET] /receptionists
module.exports.getReceptionists = async (req, res) => {
    try {
        const receptionists = await Receptionist.find({}).lean();
        return res.status(200).json(receptionists);
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error",
            error: error.message,
        });
    }
};
// [GET] /receptionists/:id
module.exports.getReceptionist = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid receptionist id format" });
        }

        const receptionist = await Receptionist.findById(id).lean();
        if (!receptionist)
            return res.status(404).json({ message: "Receptionist not found" });

        return res.status(200).json(receptionist);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// [POST] /receptionists
// FE gửi vào:
// { name, phone, email, password }
module.exports.createReceptionist = async (req, res) => {
    try {
        const { name, phone, email, password } = req.body;

        if (!name || !phone || !email || !password) {
            return res.status(400).json({
                message: "Missing required fields: name, phone, email, password",
            });
        }

        // Kiểm tra email trùng
        const existAccount = await Account.findOne({ email });
        if (existAccount) {
            return res.status(400).json({ message: "Email already exists" });
        }

        // Lấy role receptionist
        const receptionistRole = await Role.findOne({ name: "receptionist" });
        if (!receptionistRole) {
            return res.status(500).json({
                message: "Role receptionist is not configured in system",
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Tạo account mới
        const newAccount = new Account({
            email,
            password: hashedPassword,
            roleId: receptionistRole._id,
        });

        const savedAccount = await newAccount.save();

        // Tạo receptionist record
        const newReceptionist = new Receptionist({
            accountId: savedAccount._id,
            name,
            phone,
        });

        const savedReceptionist = await newReceptionist.save();

        return res.status(201).json({
            message: "Receptionist created successfully",
            data: savedReceptionist,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error creating receptionist",
            error: error.message,
        });
    }
};

// [PUT] /receptionists/:id
module.exports.updatedReceptionist = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid receptionist id format" });
        }

        const updatedReceptionist = await Receptionist.findByIdAndUpdate(
            id,
            req.body,
            { new: true }
        );

        if (!updatedReceptionist) {
            return res.status(404).json({ message: "Receptionist not found" });
        }

        return res.status(200).json(updatedReceptionist);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// [DELETE] /receptionists/:id
module.exports.deletedReceptionist = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid receptionist id format" });
        }
        // Tạo transaction để xoá cả receptionist và account liên quan
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            // Xoá receptionist
            const deletedReceptionist = await Receptionist.findByIdAndDelete(id);

            if (!deletedReceptionist) {
                return res.status(404).json({ message: "Receptionist not found" });
            }
            // Xoá luôn account liên quan
            await Account.findByIdAndDelete(deletedReceptionist.accountId);
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
        await session.commitTransaction();
        session.endSession();

        return res.json({ message: "Receptionist deleted successfully" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// [GET] /receptionists/byAccount/:accountId
module.exports.getByAccountId = async (req, res) => {
    try {
        const { accountId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(accountId)) {
            return res.status(400).json({ message: "Invalid accountId format" });
        }

        const receptionist = await Receptionist.findOne({ accountId }).lean();

        if (!receptionist) {
            return res.status(404).json({ message: "Receptionist not found" });
        }

        return res.status(200).json(receptionist);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
