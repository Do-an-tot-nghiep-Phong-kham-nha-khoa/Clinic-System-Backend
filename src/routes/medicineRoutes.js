const express = require('express');
const router = express.Router();
const Medicine = require('../models/medicine');
const { getPagingParams, applyPagingAndSortingToQuery, buildMeta, buildSearchFilter } = require('../helpers/query');
const mongoose = require('mongoose');

// /api/medicines?q=amox
// /api/medicines?page=2&limit=10&sort=-price&q=acme
router.get('/', async (req, res) => {
    try {
        const paging = getPagingParams(req.query, { sortBy: 'id', defaultLimit: 10, maxLimit: 200 });
        // Simple search across name and manufacturer via ?q= or custom param
        const search = buildSearchFilter(req.query, ['name', 'manufacturer']);
        const filter = Object.keys(search).length ? search : {};

        const total = await Medicine.countDocuments(filter);
        const query = applyPagingAndSortingToQuery(Medicine.find(filter), paging);
        const items = await query.lean();
        res.json({ data: items, meta: buildMeta(total, paging.page, paging.limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        // Create without custom id; MongoDB will generate _id
        const medicine = new Medicine({
            name: req.body.name,
            price: req.body.price,
            quantity: req.body.quantity,
            dosageForm: req.body.dosageForm,
            manufacturer: req.body.manufacturer,
            unit: req.body.unit,
            expiryDate: req.body.expiryDate
        });
        const newMedicine = await medicine.save();
        res.status(201).json(newMedicine);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const medicine = await Medicine.findById(id).lean();
        if (medicine) {
            res.json(medicine);
        } else {
            res.status(404).json({ message: 'Medicine not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const medicine = await Medicine.findById(id);
        if (medicine) {
            medicine.name = req.body.name ?? medicine.name;
            medicine.price = req.body.price ?? medicine.price;
            medicine.quantity = req.body.quantity ?? medicine.quantity;
            medicine.dosageForm = req.body.dosageForm ?? medicine.dosageForm;
            medicine.manufacturer = req.body.manufacturer ?? medicine.manufacturer;
            medicine.unit = req.body.unit ?? medicine.unit;
            medicine.expiryDate = req.body.expiryDate ?? medicine.expiryDate;
            const updatedMedicine = await medicine.save();
            res.json(updatedMedicine);
        } else {
            res.status(404).json({ message: 'Medicine not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const medicine = await Medicine.findByIdAndDelete(id);
        if (medicine) {
            res.json({ message: 'Medicine deleted' });
        } else {
            res.status(404).json({ message: 'Medicine not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;