const express = require('express');
const router = express.Router();
const Medicine = require('../models/medicine');

// Helper to generate next incremental id per collection
async function getNextId(Model) {
    const maxDoc = await Model.findOne().sort({ id: -1 }).select('id');
    return (maxDoc?.id ?? 0) + 1;
}

router.get('/', async (req, res) => {
    try {
        const medicines = await Medicine.find();
        res.json(medicines);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const nextId = await getNextId(Medicine);
        const medicine = new Medicine({
            id: nextId,
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
        const medicine = await Medicine.findOne({ id: req.params.id });
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
        const medicine = await Medicine.findOne({ id: req.params.id });
        if (medicine) {
            medicine.name = req.body.name || medicine.name;
            medicine.price = req.body.price || medicine.price;
            medicine.quantity = req.body.quantity || medicine.quantity;
            medicine.dosageForm = req.body.dosageForm || medicine.dosageForm;
            medicine.manufacturer = req.body.manufacturer || medicine.manufacturer;
            medicine.unit = req.body.unit || medicine.unit;
            medicine.expiryDate = req.body.expiryDate || medicine.expiryDate;
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
        const medicine = await Medicine.findOneAndDelete({ id: req.params.id });
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