const express = require('express');
const router = express.Router();
const Prescription = require('../models/prescription');
const MedicineInPrescription = require('../models/medicineInPrescription');
const Medicine = require('../models/medicine');

// Helper to generate next incremental id per collection
async function getNextId(Model) {
    const maxDoc = await Model.findOne().sort({ id: -1 }).select('id');
    return (maxDoc?.id ?? 0) + 1;
}

router.get('/', async (req, res) => {
    try {
        const results = await Prescription.aggregate([
            { $lookup: { from: 'medicineinprescriptions', localField: 'id', foreignField: 'prescriptionId', as: 'items' } },
            { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
            { $lookup: { from: 'medicines', localField: 'items.medicineId', foreignField: 'id', as: 'medicine' } },
            { $unwind: { path: '$medicine', preserveNullAndEmptyArrays: true } },
            { $addFields: { 'items.medicine': '$medicine' } },
            {
                $group: {
                    _id: '$_id',
                    id: { $first: '$id' },
                    createAt: { $first: '$createAt' },
                    items: { $push: '$items' }
                }
            },
            {
                $project: {
                    _id: 0,
                    id: 1,
                    createAt: 1,
                    items: {
                        $filter: {
                            input: '$items',
                            as: 'it',
                            cond: { $ne: ['$$it', null] }
                        }
                    }
                }
            }
        ]);
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const results = await Prescription.aggregate([
            { $match: { id } },
            { $lookup: { from: 'medicineinprescriptions', localField: 'id', foreignField: 'prescriptionId', as: 'items' } },
            { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
            { $lookup: { from: 'medicines', localField: 'items.medicineId', foreignField: 'id', as: 'medicine' } },
            { $unwind: { path: '$medicine', preserveNullAndEmptyArrays: true } },
            { $addFields: { 'items.medicine': '$medicine' } },
            {
                $group: {
                    _id: '$_id',
                    id: { $first: '$id' },
                    createAt: { $first: '$createAt' },
                    items: { $push: '$items' }
                }
            },
            {
                $project: {
                    _id: 0,
                    id: 1,
                    createAt: 1,
                    items: {
                        $filter: {
                            input: '$items',
                            as: 'it',
                            cond: { $ne: ['$$it', null] }
                        }
                    }
                }
            }
        ]);

        if (!results.length) {
            return res.status(404).json({ message: 'Prescription not found' });
        }
        res.json(results[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { createAt, items } = req.body;
        const createAtValue = createAt ?? new Date().toISOString();

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'items (medicines) are required' });
        }

        // Validate items and gather medicineIds
        const medicineIds = [];
        for (const it of items) {
            if (!it || it.medicineId == null) {
                return res.status(400).json({ message: 'Each item must include medicineId' });
            }
            if (it.quantity == null || it.dosage == null || it.frequency == null || it.duration == null || it.instruction == null) {
                return res.status(400).json({ message: 'Each item must include quantity, dosage, frequency, duration and instruction' });
            }
            medicineIds.push(Number(it.medicineId));
        }

        // Ensure all medicines exist
        const medicines = await Medicine.find({ id: { $in: medicineIds } }).lean();
        const medById = new Map(medicines.map(m => [m.id, m]));
        if (medById.size !== medicineIds.length) {
            return res.status(400).json({ message: 'One or more medicines not found' });
        }

        // Generate ids
        const prescriptionId = await getNextId(Prescription);
        let nextMIPId = await getNextId(MedicineInPrescription);

        // Prepare MedicineInPrescription docs
        const mipDocs = items.map(it => ({
            id: nextMIPId++,
            quantity: Number(it.quantity),
            dosage: it.dosage,
            frequency: it.frequency,
            duration: it.duration,
            instruction: it.instruction,
            medicineId: Number(it.medicineId),
            prescriptionId: prescriptionId
        }));

        // Save prescription and its items
        const prescription = new Prescription({ id: prescriptionId, createAt: createAtValue });
        await prescription.save();
        await MedicineInPrescription.insertMany(mipDocs);

        // Return enriched created prescription
        const [result] = await Prescription.aggregate([
            { $match: { id: prescriptionId } },
            { $lookup: { from: 'medicineinprescriptions', localField: 'id', foreignField: 'prescriptionId', as: 'items' } },
            { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
            { $lookup: { from: 'medicines', localField: 'items.medicineId', foreignField: 'id', as: 'medicine' } },
            { $unwind: { path: '$medicine', preserveNullAndEmptyArrays: true } },
            { $addFields: { 'items.medicine': '$medicine' } },
            { $group: { _id: '$_id', id: { $first: '$id' }, createAt: { $first: '$createAt' }, items: { $push: '$items' } } },
            { $project: { _id: 0, id: 1, createAt: 1, items: { $filter: { input: '$items', as: 'it', cond: { $ne: ['$$it', null] } } } } }
        ]);

        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const prescription = await Prescription.findOne({ id });
        if (!prescription) {
            return res.status(404).json({ message: 'Prescription not found' });
        }

        const { createAt, items } = req.body;
        if (createAt !== undefined) {
            prescription.createAt = createAt;
        }

        if (Array.isArray(items)) {
            if (items.length === 0) {
                return res.status(400).json({ message: 'items cannot be empty when provided' });
            }
            const medicineIds = [];
            for (const it of items) {
                if (!it || it.medicineId == null) {
                    return res.status(400).json({ message: 'Each item must include medicineId' });
                }
                if (it.quantity == null || it.dosage == null || it.frequency == null || it.duration == null || it.instruction == null) {
                    return res.status(400).json({ message: 'Each item must include quantity, dosage, frequency, duration and instruction' });
                }
                medicineIds.push(Number(it.medicineId));
            }
            // Ensure medicines exist
            const medicines = await Medicine.find({ id: { $in: medicineIds } }).lean();
            const medById = new Map(medicines.map(m => [m.id, m]));
            if (medById.size !== medicineIds.length) {
                return res.status(400).json({ message: 'One or more medicines not found' });
            }

            // Replace existing items
            await MedicineInPrescription.deleteMany({ prescriptionId: id });

            let nextMIPId = await getNextId(MedicineInPrescription);
            const mipDocs = items.map(it => ({
                id: nextMIPId++,
                quantity: Number(it.quantity),
                dosage: it.dosage,
                frequency: it.frequency,
                duration: it.duration,
                instruction: it.instruction,
                medicineId: Number(it.medicineId),
                prescriptionId: id
            }));
            await MedicineInPrescription.insertMany(mipDocs);
        }

        await prescription.save();

        // Return enriched prescription like GET /:id
        const [result] = await Prescription.aggregate([
            { $match: { id } },
            { $lookup: { from: 'medicineinprescriptions', localField: 'id', foreignField: 'prescriptionId', as: 'items' } },
            { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
            { $lookup: { from: 'medicines', localField: 'items.medicineId', foreignField: 'id', as: 'medicine' } },
            { $unwind: { path: '$medicine', preserveNullAndEmptyArrays: true } },
            { $addFields: { 'items.medicine': '$medicine' } },
            { $group: { _id: '$_id', id: { $first: '$id' }, createAt: { $first: '$createAt' }, items: { $push: '$items' } } },
            { $project: { _id: 0, id: 1, createAt: 1, items: { $filter: { input: '$items', as: 'it', cond: { $ne: ['$$it', null] } } } } }
        ]);

        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const prescription = await Prescription.findOneAndDelete({ id });
        if (!prescription) {
            return res.status(404).json({ message: 'Prescription not found' });
        }
        await MedicineInPrescription.deleteMany({ prescriptionId: id });
        res.json({ message: 'Prescription and related medicines deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;