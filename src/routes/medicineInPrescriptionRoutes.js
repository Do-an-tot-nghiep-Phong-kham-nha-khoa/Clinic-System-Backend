const express = require('express');
const router = express.Router();
const MedicineInPrescription = require('../models/medicineInPrescription');

router.get('/', async (req, res) => {
    try {
        const medicineInPrescriptions = await MedicineInPrescription.find();
        res.json(medicineInPrescriptions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const medicineInPrescription = await MedicineInPrescription.findOne({ id: req.params.id });
        if (medicineInPrescription) {
            res.json(medicineInPrescription);
        } else {
            res.status(404).json({ message: 'MedicineInPrescription not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', async (req, res) => {
    const medicineInPrescription = new MedicineInPrescription({
        id: req.body.id,
        quantity: req.body.quantity,
        dosage: req.body.dosage,
        frequency: req.body.frequency,
        duration: req.body.duration,
        instruction: req.body.instruction,
        medicineId: req.body.medicineId,
        prescriptionId: req.body.prescriptionId
    });
    try {
        const newMedicineInPrescription = await medicineInPrescription.save();
        res.status(201).json(newMedicineInPrescription);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const medicineInPrescription = await MedicineInPrescription.findOne({ id: req.params.id });
        if (medicineInPrescription) {
            medicineInPrescription.quantity = req.body.quantity || medicineInPrescription.quantity;
            medicineInPrescription.dosage = req.body.dosage || medicineInPrescription.dosage;
            medicineInPrescription.frequency = req.body.frequency || medicineInPrescription.frequency;
            medicineInPrescription.duration = req.body.duration || medicineInPrescription.duration;
            medicineInPrescription.instruction = req.body.instruction || medicineInPrescription.instruction;
            medicineInPrescription.medicineId = req.body.medicineId || medicineInPrescription.medicineId;
            medicineInPrescription.prescriptionId = req.body.prescriptionId || medicineInPrescription.prescriptionId;
            const updatedMedicineInPrescription = await medicineInPrescription.save();
            res.json(updatedMedicineInPrescription);
        } else {
            res.status(404).json({ message: 'MedicineInPrescription not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const medicineInPrescription = await MedicineInPrescription.findOneAndDelete({ id: req.params.id });
        if (medicineInPrescription) {
            res.json({ message: 'MedicineInPrescription deleted' });
        } else {
            res.status(404).json({ message: 'MedicineInPrescription not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;