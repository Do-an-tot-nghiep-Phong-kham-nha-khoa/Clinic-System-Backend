const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Admin = require("../models/admin");
const Account = require("../models/account");
const Role = require("../models/role");

module.exports = {
    // GET /admins
    getAdmins: async (req, res) => {
        try {
            const admins = await Admin.find({}).populate("accountId").lean();
            return res.status(200).json(admins);
        } catch (error) {
            console.error("Error fetching admins:", error);
            return res.status(500).json({
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // GET /admins/:id
    getAdmin: async (req, res) => {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({ message: "Invalid admin id format" });
            }

            const admin = await Admin.findById(id).populate("accountId").lean();

            if (!admin) {
                return res.status(404).json({ message: "Admin not found" });
            }

            return res.json(admin);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    },
    // GET /admins/account/:accountId
    getAdminByAccountId: async (req, res) => {
        try {
            const { accountId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(accountId)) {
                return res.status(400).json({ message: "Invalid account id format" });
            }
            const admin = await Admin.findOne({ accountId }).populate("accountId").lean();
            if (!admin) {
                return res.status(404).json({ message: "Admin not found" });
            }
            return res.json(admin);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    },
    // POST /admins
    createAdmin: async (req, res) => {
        try {
            const { email, password, name, phone } = req.body;
            if (!name || !email || !password) {
                return res.status(400).json({ message: "Missing required fields: name, email, password" });
            }
            // Find account by email
            const account = await Account.findOne({ email });
            if (account) {
                return res.status(401).json({ message: "Account with this email already exists" });
            }
            const newAccount = new Account({
                email,
                password: await bcrypt.hash(password, 10),
                roleId: (await Role.findOne({ name: "admin" }))._id
            });
            const savedAccount =  await newAccount.save();
            const newAdmin = new Admin({
                accountId: savedAccount._id,
                name,
                phone,
            });
            const savedAdmin = await newAdmin.save();

            return res.status(201).json(savedAdmin);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    },

    // PUT /admins/:id
    updatedAdmin: async (req, res) => {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({ message: "Invalid admin id format" });
            }

            const updatedAdmin = await Admin.findByIdAndUpdate(
                id,
                req.body,
                { new: true }
            );

            if (!updatedAdmin) {
                return res.status(404).json({ message: "Admin not found" });
            }

            return res.json(updatedAdmin);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    },

    // DELETE /admins/:id
    deleteAdmin: async (req, res) => {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({ message: "Invalid admin id format" });
            }

            const deletedAdmin = await Admin.findByIdAndDelete(id);

            if (!deletedAdmin) {
                return res.status(404).json({ message: "Admin not found" });
            }

            return res.json({ message: "Admin deleted successfully" });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }
};
