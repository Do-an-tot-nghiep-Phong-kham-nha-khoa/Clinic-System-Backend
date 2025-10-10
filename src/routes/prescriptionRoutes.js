const express = require('express');
const router = express.Router();
const Prescription = require('../models/prescription');

router.get('/', async (req, res) => {
    try {
        const prescriptions = await Prescription.find();
        res.json(prescriptions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const prescription = await Prescription.findOne({ id: req.params.id });
        if (prescription) {
            res.json(prescription);
        } else {
            res.status(404).json({ message: 'Prescription not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', async (req, res) => {
    const prescription = new Prescription({
        id: req.body.id,
        createAt: req.body.createAt
    });
    try {
        const newPrescription = await prescription.save();
        res.status(201).json(newPrescription);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const prescription = await Prescription.findOne({ id: req.params.id });
        if (prescription) {
            prescription.createAt = req.body.createAt || prescription.createAt;
            const updatedPrescription = await prescription.save();
            res.json(updatedPrescription);
        } else {
            res.status(404).json({ message: 'Prescription not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const prescription = await Prescription.findOneAndDelete({ id: req.params.id });
        if (prescription) {
            res.json({ message: 'Prescription deleted' });
        } else {
            res.status(404).json({ message: 'Prescription not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;