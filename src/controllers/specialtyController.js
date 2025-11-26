const mongoose = require("mongoose");
const Specialty = require("../models/specialty");

// GET /specialties
exports.list = async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = 'name', q } = req.query;
        const pageNumber = Math.max(parseInt(page), 1);
        const pageSize = Math.min(Math.max(parseInt(limit), 1), 100);

        const filter = {};
        if (q) {
            const regex = new RegExp(q, 'i');
            filter.$or = [{ name: regex }, { description: regex }];
        }

        const sortOption = {};
        if (sort) {
            const [field, order] = sort.split(':');
            sortOption[field] = order === 'desc' ? -1 : 1;
        }

        const [specialties, total] = await Promise.all([
            Specialty.find(filter)
                .sort(sortOption)
                .skip((pageNumber - 1) * pageSize)
                .limit(pageSize),
            Specialty.countDocuments(filter),
        ]);

        const meta = {
            total,
            page: pageNumber,
            limit: pageSize,
            totalPages: Math.ceil(total / pageSize),
        };

        return res.status(200).json({ data: specialties, meta });

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

// POST /specialties
exports.create = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Name is required' });
        }

        // Check if specialty with same name exists
        const existing = await Specialty.findOne({ name });
        if (existing) {
            return res.status(400).json({ message: 'Specialty with this name already exists' });
        }

        const newSpecialty = new Specialty({ name, description });
        const savedSpecialty = await newSpecialty.save();

        res.status(201).json({ data: savedSpecialty });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// PUT /specialties/:id
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;

        const updatedSpecialty = await Specialty.findByIdAndUpdate(id, updateData, { new: true });
        if (!updatedSpecialty) {
            return res.status(404).json({ message: 'Specialty not found' });
        }

        res.json({ data: updatedSpecialty });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// DELETE /specialties/:id
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }

        const deletedSpecialty = await Specialty.findByIdAndDelete(id);
        if (!deletedSpecialty) {
            return res.status(404).json({ message: 'Specialty not found' });
        }

        res.json({ message: 'Specialty deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};