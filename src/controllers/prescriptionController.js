const express = require('express');
const mongoose = require('mongoose');
const Prescription = require('../models/prescription');
const MedicineInPrescription = require('../models/medicineInPrescription');
const Medicine = require('../models/medicine');
const { getPagingParams, buildPipelineStages, buildMeta, buildSearchFilter } = require('../helpers/query');

// GET /api/prescriptions
exports.list = async (req, res) => {
    try {
        const { query } = req;
        const paging = getPagingParams(query, { sortBy: '_id', defaultLimit: 20, maxLimit: 200 });

        const match = {
            ...(query.id && mongoose.isValidObjectId(query.id) && { _id: new mongoose.Types.ObjectId(query.id) }),
            ...(query.patientId && mongoose.isValidObjectId(query.patientId) && { patientId: new mongoose.Types.ObjectId(query.patientId) }),
            ...(query.dateFrom || query.dateTo
                ? {
                    createAt: {
                        ...(query.dateFrom && { $gte: new Date(query.dateFrom) }),
                        ...(query.dateTo && { $lte: new Date(query.dateTo) }),
                    },
                }
                : {}),
        };

        const pipeline = [
            ...(Object.keys(match).length ? [{ $match: match }] : []),
            { $lookup: { from: 'medicineinprescriptions', localField: '_id', foreignField: 'prescriptionId', as: 'items' } },
            { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
            ...(query.medicineId && mongoose.isValidObjectId(query.medicineId)
                ? [{ $match: { 'items.medicineId': new mongoose.Types.ObjectId(query.medicineId) } }]
                : []),
            { $lookup: { from: 'medicines', localField: 'items.medicineId', foreignField: '_id', as: 'items.medicine' } },
            { $unwind: { path: '$items.medicine', preserveNullAndEmptyArrays: true } },
            ...(Object.keys((search = buildSearchFilter(query, [
                'items.dosage', 'items.frequency', 'items.duration', 'items.instruction',
                'items.medicine.name', 'items.medicine.manufacturer', '_id'
            ]))).length
                ? [{ $match: search }]
                : []),
            {
                $group: {
                    _id: '$_id',
                    id: { $first: '$_id' },
                    createAt: { $first: '$createAt' },
                    patientId: { $first: '$patientId' },
                    totalPrice: { $first: '$totalPrice' },
                    updatedAt: { $first: '$updatedAt' },
                    __v: { $first: '$__v' },
                    items: { $push: { $cond: [{ $ne: ['$items', null] }, '$items', '$$REMOVE'] } },
                },
            },
            { $project: { _id: 0, id: 1, createAt: 1, patientId: 1, totalPrice: 1, updatedAt: 1, __v: 1, items: 1 } },
        ];

        const [data, [{ total = 0 } = {}]] = await Promise.all([
            Prescription.aggregate([...pipeline, ...buildPipelineStages(paging)]),
            Prescription.aggregate([...pipeline, { $count: 'total' }]),
        ]);

        res.json({ data, meta: buildMeta(total, paging.page, paging.limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/prescriptions
exports.create = async (req, res) => {
    try {
        const { createAt = new Date().toISOString(), patientId, items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Items (medicines) are required' });
        }

        const requiredFields = ['medicineId', 'quantity', 'dosage', 'frequency', 'duration', 'instruction'];
        for (const item of items) {
            if (!item || requiredFields.some((field) => item[field] == null)) {
                return res.status(400).json({ message: 'Each item must include medicineId, quantity, dosage, frequency, duration, and instruction' });
            }
            if (!mongoose.isValidObjectId(item.medicineId)) {
                return res.status(400).json({ message: `Invalid medicineId: ${item.medicineId}` });
            }
        }

        if (!mongoose.isValidObjectId(patientId)) {
            return res.status(400).json({ message: `Invalid patientId: ${patientId}` });
        }

        const medicineIds = items.map((item) => new mongoose.Types.ObjectId(item.medicineId));
        const medicines = await Medicine.find({ _id: { $in: medicineIds } }).lean();
        if (medicines.length !== new Set(medicineIds.map((id) => id.toString())).size) {
            return res.status(400).json({ message: 'One or more medicines not found' });
        }

        const medicinePriceMap = new Map(medicines.map((m) => [m._id.toString(), m.price || 0]));
        const totalPrice = items.reduce((sum, item) => {
            const price = medicinePriceMap.get(item.medicineId.toString()) || 0;
            return sum + price * Number(item.quantity);
        }, 0);

        const prescription = new Prescription({ createAt, patientId, totalPrice });
        await prescription.save();

        const mipDocs = items.map((item) => ({
            prescriptionId: prescription._id,
            medicineId: new mongoose.Types.ObjectId(item.medicineId),
            quantity: Number(item.quantity),
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            instruction: item.instruction,
        }));
        await MedicineInPrescription.insertMany(mipDocs);

        const [result] = await Prescription.aggregate([
            { $match: { _id: prescription._id } },
            { $lookup: { from: 'medicineinprescriptions', localField: '_id', foreignField: 'prescriptionId', as: 'items' } },
            { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
            { $lookup: { from: 'medicines', localField: 'items.medicineId', foreignField: '_id', as: 'items.medicine' } },
            { $unwind: { path: '$items.medicine', preserveNullAndEmptyArrays: true } },
            { $group: { _id: '$_id', id: { $first: '$_id' }, createAt: { $first: '$createAt' }, patientId: { $first: '$patientId' }, totalPrice: { $first: '$totalPrice' }, items: { $push: '$items' } } },
            { $project: { _id: 0, id: 1, createAt: 1, patientId: 1, totalPrice: 1, items: 1 } },
        ]);

        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};