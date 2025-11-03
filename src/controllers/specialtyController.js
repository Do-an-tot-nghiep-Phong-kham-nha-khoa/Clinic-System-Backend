const mongoose = require("mongoose");
const Specialty = require("../models/specialty");

// GET /specialties
exports.list = async (req, res) => {
    try {
        const specialties = await Specialty.find({});

        return res.status(200).json(specialties)

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server nội bộ',
            error: error.message
        });
    }
}

// GET /specialties/:id
exports.get = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const specialty = await Specialty.findById(id).lean();
        if (!specialty) return res.status(404).json({ message: 'Specialty not found' });
        res.json(specialty);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};