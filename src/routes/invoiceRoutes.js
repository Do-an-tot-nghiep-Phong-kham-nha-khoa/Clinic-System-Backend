const express = require('express');
const router = express.Router();
const Invoice = require('../models/invoice');
const Prescription = require('../models/prescription');
const LabOrder = require('../models/labOrder');
const { getPagingParams, buildPipelineStages, buildMeta, buildSearchFilter } = require('../helpers/query');
const mongoose = require('mongoose');

// /api/invoices?page=2&limit=10&sort=-createAt&status=Paid
// /api/invoices?q=teeth&minTotalPrice=100&maxTotalPrice=500
// /api/invoices?prescriptionId=101&labOrderId=5005
router.get('/', async (req, res) => {
    try {
        const { query } = req;
        const paging = getPagingParams(query, { sortBy: '_id', defaultLimit: 20, maxLimit: 200 });

        // Build query conditions
        const conditions = {
            ...(query.id && { _id: new mongoose.Types.ObjectId(query.id) }),
            ...(query.status && { status: String(query.status) }),
            ...(query.prescriptionId && { prescriptionId: new mongoose.Types.ObjectId(query.prescriptionId) }),
            ...(query.labOrderId && { labOrderId: new mongoose.Types.ObjectId(query.labOrderId) }),
            ...(query.dateFrom || query.dateTo ? {
                createAt: {
                    ...(query.dateFrom && { $gte: new Date(query.dateFrom) }),
                    ...(query.dateTo && { $lte: new Date(query.dateTo) })
                }
            } : {}),
            ...(query.minTotalPrice || query.maxTotalPrice ? {
                totalPrice: {
                    ...(query.minTotalPrice && { $gte: Number(query.minTotalPrice) }),
                    ...(query.maxTotalPrice && { $lte: Number(query.maxTotalPrice) })
                }
            } : {})
        };

        // Query with populate
        let dataQuery = Invoice.find(conditions)
            .populate({
                path: 'prescriptionId',
                populate: { path: 'items', populate: { path: 'medicineId', model: 'Medicine', select: 'name description price' } }
            })
            .populate({
                path: 'labOrderId',
                populate: { path: 'items', populate: { path: 'serviceId', model: 'Service', select: 'name description price' } }
            })
            .lean();

        // Build search conditions
        const searchFields = [
            'status',
            '_id',
            'prescriptionId.items.medicineId.name',
            'labOrderId.items.serviceId.name',
            'labOrderId.items.description'
        ];
        const search = buildSearchFilter(query, searchFields);
        if (Object.keys(search).length) {
            dataQuery = dataQuery.where({
                $or: [
                    { status: { $regex: search.$text || '', $options: 'i' } },
                    { _id: { $regex: search.$text || '', $options: 'i' } },
                    { 'prescriptionId.items.medicineId.name': { $regex: search.$text || '', $options: 'i' } },
                    { 'labOrderId.items.serviceId.name': { $regex: search.$text || '', $options: 'i' } },
                    { 'labOrderId.items.description': { $regex: search.$text || '', $options: 'i' } }
                ]
            });
        }

        // Apply sorting and paging
        dataQuery = dataQuery
            .sort(paging.sortBy)
            .skip((paging.page - 1) * paging.limit)
            .limit(paging.limit);

        // Execute queries in parallel
        const [data, total] = await Promise.all([
            dataQuery.exec(),
            Invoice.countDocuments(conditions)
        ]);

        // Transform response to match desired format
        const filteredData = data.map(invoice => ({
            _id: invoice._id,
            createAt: invoice.createAt,
            totalPrice: invoice.totalPrice,
            status: invoice.status,
            prescription: invoice.prescriptionId && Array.isArray(invoice.prescriptionId.items) ? {
                _id: invoice.prescriptionId._id,
                createAt: invoice.prescriptionId.createAt,
                items: invoice.prescriptionId.items.map(item => ({
                    _id: item._id,
                    quantity: item.quantity,
                    dosage: item.dosage,
                    frequency: item.frequency,
                    duration: item.duration,
                    instruction: item.instruction,
                    medicineId: item.medicineId ? item.medicineId._id : null,
                    prescriptionId: item.prescriptionId,
                    medicine: item.medicineId
                }))
            } : null,
            labOrder: invoice.labOrderId && Array.isArray(invoice.labOrderId.items) ? {
                _id: invoice.labOrderId._id,
                testTime: invoice.labOrderId.testTime,
                totalPrice: invoice.labOrderId.totalPrice,
                items: invoice.labOrderId.items.map(item => ({
                    _id: item._id,
                    quantity: item.quantity,
                    description: item.description,
                    serviceId: item.serviceId ? item.serviceId._id : null,
                    labOrderId: item.labOrderId,
                    service: item.serviceId
                }))
            } : null
        }));

        res.json({ data: filteredData, meta: buildMeta(total, paging.page, paging.limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
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
    try {
        const { createAt = new Date().toISOString(), status = 'Pending', patientId, prescriptionId, labOrderId } = req.body;

        // Validate input
        if (!patientId || !mongoose.isValidObjectId(patientId)) {
            return res.status(400).json({ message: 'Valid patientId is required' });
        }
        if (prescriptionId && !mongoose.isValidObjectId(prescriptionId)) {
            return res.status(400).json({ message: `Invalid prescriptionId: ${prescriptionId}` });
        }
        if (labOrderId && !mongoose.isValidObjectId(labOrderId)) {
            return res.status(400).json({ message: `Invalid labOrderId: ${labOrderId}` });
        }
        if (!['Paid', 'Cancelled', 'Pending', 'Refunded'].includes(status)) {
            return res.status(400).json({ message: `Invalid status: ${status}` });
        }

        // Verify prescription and labOrder exist
        let prescriptionTotalPrice = 0;
        let labOrderTotalPrice = 0;

        if (prescriptionId) {
            const prescription = await Prescription.findById(prescriptionId).lean();
            if (!prescription) {
                return res.status(400).json({ message: `Prescription not found: ${prescriptionId}` });
            }
            prescriptionTotalPrice = Number(prescription.totalPrice) || 0;
            if (isNaN(prescriptionTotalPrice) || prescriptionTotalPrice < 0) {
                return res.status(400).json({ message: `Invalid totalPrice for prescription: ${prescriptionId}` });
            }
        }

        if (labOrderId) {
            const labOrder = await LabOrder.findById(labOrderId).lean();
            if (!labOrder) {
                return res.status(400).json({ message: `LabOrder not found: ${labOrderId}` });
            }
            labOrderTotalPrice = Number(labOrder.totalPrice) || 0;
            if (isNaN(labOrderTotalPrice) || labOrderTotalPrice < 0) {
                return res.status(400).json({ message: `Invalid totalPrice for labOrder: ${labOrderId}` });
            }
        }

        // Calculate totalPrice
        const totalPrice = prescriptionTotalPrice + labOrderTotalPrice;

        // Create invoice
        const invoice = new Invoice({
            createAt,
            totalPrice,
            status,
            patientId,
            prescriptionId: prescriptionId || null,
            labOrderId: labOrderId || null
        });
        await invoice.save();

        // Fetch enriched invoice
        const result = await Invoice.findById(invoice._id)
            .populate({
                path: 'prescriptionId',
                populate: { path: 'items', populate: { path: 'medicineId', model: 'Medicine', select: 'name description price' } }
            })
            .populate({
                path: 'labOrderId',
                populate: { path: 'items', populate: { path: 'serviceId', model: 'Service', select: 'name description price' } }
            })
            .lean();

        // Transform response
        const response = {
            _id: result._id,
            createAt: result.createAt,
            totalPrice: result.totalPrice,
            status: result.status,
            patientId: result.patientId,
            prescription: result.prescriptionId && result.prescriptionId.items ? {
                _id: result.prescriptionId._id,
                createAt: result.prescriptionId.createAt,
                totalPrice: result.prescriptionId.totalPrice,
                items: result.prescriptionId.items.map(item => ({
                    _id: item._id,
                    quantity: item.quantity,
                    dosage: item.dosage,
                    frequency: item.frequency,
                    duration: item.duration,
                    instruction: item.instruction,
                    medicineId: item.medicineId ? item.medicineId._id : null,
                    prescriptionId: item.prescriptionId,
                    medicine: item.medicineId
                }))
            } : null,
            labOrder: result.labOrderId && result.labOrderId.items ? {
                _id: result.labOrderId._id,
                testTime: result.labOrderId.testTime,
                totalPrice: result.labOrderId.totalPrice,
                items: result.labOrderId.items.map(item => ({
                    _id: item._id,
                    quantity: item.quantity,
                    description: item.description,
                    serviceId: item.serviceId ? item.serviceId._id : null,
                    labOrderId: item.labOrderId,
                    service: item.serviceId
                }))
            } : null
        };

        res.status(201).json(response);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const invoice = await Invoice.findOne(id);
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
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const invoice = await Invoice.findOneAndDelete(id);
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