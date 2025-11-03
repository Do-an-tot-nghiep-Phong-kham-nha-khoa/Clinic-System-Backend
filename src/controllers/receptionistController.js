const mongoose = require("mongoose");
const Receptionist = require("../models/receptionist");

// GET /receptionists
exports.list = async (req, res) => {
    try {
        const receptionists = await Receptionist.find({});
        return res.status(200).json(receptionists)
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server nội bộ',
            error: error.message
        });
    }
}

// GET /receptionists/:id
exports.get = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const receptionist = await Receptionist.findById(id).lean();
        if (!receptionist) return res.status(404).json({ message: 'Receptionist not found' });
        res.json(receptionist);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /receptionists
exports.create = async (req, res) => {
    try {
        const { accountId, name, phone } = req.body;

        // validate accountId
        if (!mongoose.Types.ObjectId.isValid(accountId)) {
            return res.status(400).json({ message: 'Invalid accountId format' });
        }
        const newReceptionist = new Receptionist({
            accountId,
            name,
            phone
        });
        const savedReceptionist = await newReceptionist.save();
        res.status(201).json(savedReceptionist);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT /receptionists/:id
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const updatedReceptionist = await Receptionist.findByIdAndUpdate(id, req
            .body, { new: true });
        if (!updatedReceptionist) return res.status(404).json({ message: 'Receptionist not found' });
        res.json(updatedReceptionist);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE /receptionists/:id
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const deletedReceptionist = await Receptionist.findByIdAndDelete(id);
        if (!deletedReceptionist) return res.status(404).json({ message: 'Receptionist not found' });
        res.json({ message: 'Receptionist deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /receptionists/byAccount/:accountId
exports.getByAccountId = async (req, res) => {
    try {
        const { accountId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(accountId)) {
            return res.status(400).json({ message: 'Invalid accountId format' });
        }
        const receptionist = await Receptionist.findOne({ accountId: accountId }).lean();
        if (!receptionist) return res.status(404).json({ message: 'Receptionist not found' });
        res.json(receptionist);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};