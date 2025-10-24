const mongoose = require('mongoose');
const Medicine = require('../models/medicine');
const { getPagingParams, applyPagingAndSortingToQuery, buildMeta, buildSearchFilter } = require('../helpers/query');

// GET /api/medicines
exports.list = async (req, res) => {
    try {
        const paging = getPagingParams(req.query, { sortBy: '_id', defaultLimit: 10, maxLimit: 200 });
        const search = buildSearchFilter(req.query, ['name', 'manufacturer']);
        const filter = Object.keys(search).length ? search : {};

        const total = await Medicine.countDocuments(filter);
        const query = applyPagingAndSortingToQuery(Medicine.find(filter), paging);
        const items = await query.lean();
        res.json({ data: items, meta: buildMeta(total, paging.page, paging.limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/medicines
exports.create = async (req, res) => {
    try {
        const medicine = new Medicine({
            name: req.body.name,
            price: req.body.price,
            quantity: req.body.quantity,
            dosageForm: req.body.dosageForm,
            manufacturer: req.body.manufacturer,
            unit: req.body.unit,
            expiryDate: req.body.expiryDate,
        });
        const newMedicine = await medicine.save();
        res.status(201).json(newMedicine);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// GET /api/medicines/:id
exports.get = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const medicine = await Medicine.findById(id).lean();
        if (!medicine) return res.status(404).json({ message: 'Medicine not found' });
        res.json(medicine);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT /api/medicines/:id
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const medicine = await Medicine.findById(id);
        if (!medicine) return res.status(404).json({ message: 'Medicine not found' });

        medicine.name = req.body.name ?? medicine.name;
        medicine.price = req.body.price ?? medicine.price;
        medicine.quantity = req.body.quantity ?? medicine.quantity;
        medicine.dosageForm = req.body.dosageForm ?? medicine.dosageForm;
        medicine.manufacturer = req.body.manufacturer ?? medicine.manufacturer;
        medicine.unit = req.body.unit ?? medicine.unit;
        medicine.expiryDate = req.body.expiryDate ?? medicine.expiryDate;

        const updated = await medicine.save();
        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// DELETE /api/medicines/:id
exports.remove = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const medicine = await Medicine.findByIdAndDelete(id);
        if (!medicine) return res.status(404).json({ message: 'Medicine not found' });
        res.json({ message: 'Medicine deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};