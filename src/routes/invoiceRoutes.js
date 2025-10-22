const express = require('express');
const router = express.Router();
const Invoice = require('../models/invoice');
const Prescription = require('../models/prescription');
const LabOrder = require('../models/labOrder');
const { getPagingParams, buildPipelineStages, buildMeta, buildSearchFilter } = require('../helpers/query');

// /api/invoices?page=2&limit=10&sort=-createAt&status=Paid
// /api/invoices?q=teeth&minTotalPrice=100&maxTotalPrice=500
// /api/invoices?prescriptionId=101&labOrderId=5005
router.get('/', async (req, res) => {
    try {
        const paging = getPagingParams(req.query, { sortBy: 'id', defaultLimit: 20, maxLimit: 200 });

        // Root-level filters
        const rootMatch = {};
        if (req.query.id) rootMatch.id = Number(req.query.id);
        if (req.query.status) rootMatch.status = String(req.query.status);
        if (req.query.prescriptionId) rootMatch.prescriptionId = Number(req.query.prescriptionId);
        if (req.query.labOrderId) rootMatch.labOrderId = Number(req.query.labOrderId);
        if (req.query.dateFrom || req.query.dateTo) {
            rootMatch.createAt = {};
            if (req.query.dateFrom) rootMatch.createAt.$gte = new Date(req.query.dateFrom);
            if (req.query.dateTo) rootMatch.createAt.$lte = new Date(req.query.dateTo);
        }
        if (req.query.minTotalPrice || req.query.maxTotalPrice) {
            rootMatch.totalPrice = {};
            if (req.query.minTotalPrice) rootMatch.totalPrice.$gte = Number(req.query.minTotalPrice);
            if (req.query.maxTotalPrice) rootMatch.totalPrice.$lte = Number(req.query.maxTotalPrice);
        }

        const baseLookups = [
            {
                $lookup: {
                    from: 'prescriptions',
                    let: { pid: '$prescriptionId' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$id', '$$pid'] } } },
                        { $lookup: { from: 'medicineinprescriptions', localField: 'id', foreignField: 'prescriptionId', as: 'items' } },
                        { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
                        { $lookup: { from: 'medicines', localField: 'items.medicineId', foreignField: 'id', as: 'medicine' } },
                        { $unwind: { path: '$medicine', preserveNullAndEmptyArrays: true } },
                        { $addFields: { 'items.medicine': '$medicine' } },
                        { $group: { _id: '$_id', id: { $first: '$id' }, createAt: { $first: '$createAt' }, items: { $push: '$items' } } },
                        { $project: { _id: 0, id: 1, createAt: 1, items: { $filter: { input: '$items', as: 'it', cond: { $ne: ['$$it', null] } } } } }
                    ],
                    as: 'prescription'
                }
            },
            { $unwind: { path: '$prescription', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'laborders',
                    let: { lid: '$labOrderId' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$id', '$$lid'] } } },
                        { $lookup: { from: 'serviceinlaborders', localField: 'id', foreignField: 'labOrderId', as: 'items' } },
                        { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
                        { $lookup: { from: 'services', localField: 'items.serviceId', foreignField: 'id', as: 'service' } },
                        { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
                        { $addFields: { 'items.service': '$service' } },
                        { $group: { _id: '$_id', id: { $first: '$id' }, testTime: { $first: '$testTime' }, totalPrice: { $first: '$totalPrice' }, items: { $push: '$items' } } },
                        { $project: { _id: 0, id: 1, testTime: 1, totalPrice: 1, items: { $filter: { input: '$items', as: 'it', cond: { $ne: ['$$it', null] } } } } }
                    ],
                    as: 'labOrder'
                }
            },
            { $unwind: { path: '$labOrder', preserveNullAndEmptyArrays: true } },
            // Add text-friendly fields
            { $addFields: { idStr: { $toString: '$id' } } }
        ];

        // Build the full pipeline
        const pipeline = [];
        if (Object.keys(rootMatch).length) pipeline.push({ $match: rootMatch });
        pipeline.push(...baseLookups);

        // Text search across invoice status/id, medicine name, and service name/description
        const search = buildSearchFilter(req.query, [
            'status', 'idStr',
            'prescription.items.medicine.name',
            'labOrder.items.service.name',
            'labOrder.items.description'
        ]);
        if (Object.keys(search).length) pipeline.push({ $match: search });

        // Prepare data and count pipelines
        const prePagingPipeline = [...pipeline];
        const dataPipeline = [...prePagingPipeline, ...buildPipelineStages(paging)];

        const [data, countArr] = await Promise.all([
            Invoice.aggregate(dataPipeline),
            Invoice.aggregate([...prePagingPipeline, { $count: 'total' }])
        ]);
        const total = countArr[0]?.total || 0;

        res.json({ data, meta: buildMeta(total, paging.page, paging.limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const results = await Invoice.aggregate([
            { $match: { id } },
            {
                $lookup: {
                    from: 'prescriptions',
                    let: { pid: '$prescriptionId' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$id', '$$pid'] } } },
                        { $lookup: { from: 'medicineinprescriptions', localField: 'id', foreignField: 'prescriptionId', as: 'items' } },
                        { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
                        { $lookup: { from: 'medicines', localField: 'items.medicineId', foreignField: 'id', as: 'medicine' } },
                        { $unwind: { path: '$medicine', preserveNullAndEmptyArrays: true } },
                        { $addFields: { 'items.medicine': '$medicine' } },
                        { $group: { _id: '$_id', id: { $first: '$id' }, createAt: { $first: '$createAt' }, items: { $push: '$items' } } },
                        { $project: { _id: 0, id: 1, createAt: 1, items: { $filter: { input: '$items', as: 'it', cond: { $ne: ['$$it', null] } } } } }
                    ],
                    as: 'prescription'
                }
            },
            { $unwind: { path: '$prescription', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'laborders',
                    let: { lid: '$labOrderId' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$id', '$$lid'] } } },
                        { $lookup: { from: 'serviceinlaborders', localField: 'id', foreignField: 'labOrderId', as: 'items' } },
                        { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
                        { $lookup: { from: 'services', localField: 'items.serviceId', foreignField: 'id', as: 'service' } },
                        { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
                        { $addFields: { 'items.service': '$service' } },
                        { $group: { _id: '$_id', id: { $first: '$id' }, testTime: { $first: '$testTime' }, totalPrice: { $first: '$totalPrice' }, items: { $push: '$items' } } },
                        { $project: { _id: 0, id: 1, testTime: 1, totalPrice: 1, items: { $filter: { input: '$items', as: 'it', cond: { $ne: ['$$it', null] } } } } }
                    ],
                    as: 'labOrder'
                }
            },
            { $unwind: { path: '$labOrder', preserveNullAndEmptyArrays: true } }
        ]);

        if (!results.length) {
            return res.status(404).json({ message: 'Invoice not found' });
        }
        res.json(results[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', async (req, res) => {
    const invoice = new Invoice({
        id: req.body.id,
        createAt: req.body.createAt,
        totalPrice: req.body.totalPrice,
        status: req.body.status,
        prescriptionId: req.body.prescriptionId,
        labOrderId: req.body.labOrderId
    });
    try {
        const newInvoice = await invoice.save();
        res.status(201).json(newInvoice);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ id: req.params.id });
        if (invoice) {
            invoice.createAt = req.body.createAt || invoice.createAt;
            invoice.totalPrice = req.body.totalPrice || invoice.totalPrice;
            invoice.status = req.body.status || invoice.status;
            invoice.prescriptionId = req.body.prescriptionId || invoice.prescriptionId;
            invoice.labOrderId = req.body.labOrderId || invoice.labOrderId;
            const updatedInvoice = await invoice.save();
            res.json(updatedInvoice);
        } else {
            res.status(404).json({ message: 'Invoice not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const invoice = await Invoice.findOneAndDelete({ id: req.params.id });
        if (invoice) {
            res.json({ message: 'Invoice deleted' });
        } else {
            res.status(404).json({ message: 'Invoice not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;