const express = require('express');
const router = express.Router();
const LabOrder = require('../models/labOrder');
const ServiceInLabOrder = require('../models/serviceInLabOrder');
const Service = require('../models/service');
const { getPagingParams, buildPipelineStages, buildMeta, buildSearchFilter } = require('../helpers/query');

// Helper to generate next incremental id per collection
async function getNextId(Model) {
    const maxDoc = await Model.findOne().sort({ id: -1 }).select('id');
    return (maxDoc?.id ?? 0) + 1;
}

// /api/laborders?page=2&limit=10&sort=-testTime
// /api/laborders?dateFrom=2025-10-01&dateTo=2025-10-31&q=urinalysis
// /api/laborders?serviceId=22&minTotalPrice=100&sortBy=totalPrice&sortOrder=desc
router.get('/', async (req, res) => {
    try {
        const paging = getPagingParams(req.query, { sortBy: 'id', defaultLimit: 20, maxLimit: 200 });

        // Root-level filters (before lookups)
        const rootMatch = {};
        if (req.query.id) rootMatch.id = Number(req.query.id);
        if (req.query.dateFrom || req.query.dateTo) {
            rootMatch.testTime = {};
            if (req.query.dateFrom) rootMatch.testTime.$gte = new Date(req.query.dateFrom);
            if (req.query.dateTo) rootMatch.testTime.$lte = new Date(req.query.dateTo);
        }
        if (req.query.minTotalPrice || req.query.maxTotalPrice) {
            rootMatch.totalPrice = {};
            if (req.query.minTotalPrice) rootMatch.totalPrice.$gte = Number(req.query.minTotalPrice);
            if (req.query.maxTotalPrice) rootMatch.totalPrice.$lte = Number(req.query.maxTotalPrice);
        }

        const pipeline = [];
        if (Object.keys(rootMatch).length) pipeline.push({ $match: rootMatch });

        // Join items and optionally filter by serviceId
        pipeline.push(
            { $lookup: { from: 'serviceinlaborders', localField: 'id', foreignField: 'labOrderId', as: 'items' } },
            { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } }
        );

        if (req.query.serviceId) {
            pipeline.push({ $match: { 'items.serviceId': Number(req.query.serviceId) } });
        }

        // Join services and support search
        pipeline.push(
            { $lookup: { from: 'services', localField: 'items.serviceId', foreignField: 'id', as: 'service' } },
            { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
            { $addFields: { 'items.service': '$service', idStr: { $toString: '$id' } } }
        );

        // Text search across service and item descriptions, and id string
        const search = buildSearchFilter(req.query, ['items.description', 'service.name', 'service.description', 'idStr']);
        if (Object.keys(search).length) pipeline.push({ $match: search });

        // Group back to one doc per LabOrder and project
        pipeline.push(
            {
                $group: {
                    _id: '$_id',
                    id: { $first: '$id' },
                    testTime: { $first: '$testTime' },
                    totalPrice: { $first: '$totalPrice' },
                    createdAt: { $first: '$createdAt' },
                    updatedAt: { $first: '$updatedAt' },
                    items: { $push: '$items' }
                }
            },
            {
                $project: {
                    _id: 0,
                    id: 1,
                    testTime: 1,
                    totalPrice: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    items: {
                        $filter: {
                            input: '$items',
                            as: 'it',
                            cond: { $ne: ['$$it', null] }
                        }
                    }
                }
            }
        );

        // Prepare pipelines for data and total count
        const prePagingPipeline = [...pipeline];
        const dataPipeline = [...prePagingPipeline, ...buildPipelineStages(paging)];

        const [data, countArr] = await Promise.all([
            LabOrder.aggregate(dataPipeline),
            LabOrder.aggregate([...prePagingPipeline, { $count: 'total' }])
        ]);
        const total = countArr[0]?.total || 0;

        res.json({ data, meta: buildMeta(total, paging.page, paging.limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { testTime, items } = req.body;
        if (!testTime) {
            return res.status(400).json({ message: 'testTime is required' });
        }
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'items (selected services) are required' });
        }

        // Ensure all items have serviceId and quantity (default 1)
        const serviceIds = [];
        for (const it of items) {
            if (it == null || it.serviceId == null) {
                return res.status(400).json({ message: 'Each item must include serviceId' });
            }
            serviceIds.push(Number(it.serviceId));
        }

        // Fetch services to fill missing price/description
        const services = await Service.find({ id: { $in: serviceIds } }).lean();
        const serviceById = new Map(services.map(s => [s.id, s]));
        if (serviceById.size !== serviceIds.length) {
            return res.status(400).json({ message: 'One or more services not found' });
        }

        // Generate new LabOrder id
        const labOrderId = await getNextId(LabOrder);

        // Prepare ServiceInLabOrder documents with auto-increment ids
        let nextSILId = await getNextId(ServiceInLabOrder);
        let total = 0;
        const silDocs = items.map(it => {
            const svc = serviceById.get(Number(it.serviceId));
            const quantity = Number(it.quantity ?? 1);
            const price = Number(it.price ?? svc.price);
            const description = it.description ?? svc.description;
            total += price * quantity;
            return {
                id: nextSILId++,
                price,
                description,
                quantity,
                serviceId: svc.id,
                labOrderId
            };
        });

        // Create LabOrder with computed totalPrice
        const labOrder = new LabOrder({
            id: labOrderId,
            testTime,
            totalPrice: Number(total.toFixed(2))
        });
        await labOrder.save();
        await ServiceInLabOrder.insertMany(silDocs);

        // Return enriched created lab order
        const [result] = await LabOrder.aggregate([
            { $match: { id: labOrderId } },
            { $lookup: { from: 'serviceinlaborders', localField: 'id', foreignField: 'labOrderId', as: 'items' } },
            { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
            { $lookup: { from: 'services', localField: 'items.serviceId', foreignField: 'id', as: 'service' } },
            { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
            { $addFields: { 'items.service': '$service' } },
            {
                $group: {
                    _id: '$_id',
                    id: { $first: '$id' },
                    testTime: { $first: '$testTime' },
                    totalPrice: { $first: '$totalPrice' },
                    createdAt: { $first: '$createdAt' },
                    updatedAt: { $first: '$updatedAt' },
                    items: { $push: '$items' }
                }
            },
            {
                $project: {
                    _id: 0,
                    id: 1,
                    testTime: 1,
                    totalPrice: 1,
                    createdAt: 1,
                    updatedAt: 1,
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

        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const results = await LabOrder.aggregate([
            { $match: { id } },
            { $lookup: { from: 'serviceinlaborders', localField: 'id', foreignField: 'labOrderId', as: 'items' } },
            { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
            { $lookup: { from: 'services', localField: 'items.serviceId', foreignField: 'id', as: 'service' } },
            { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
            { $addFields: { 'items.service': '$service' } },
            {
                $group: {
                    _id: '$_id',
                    id: { $first: '$id' },
                    testTime: { $first: '$testTime' },
                    totalPrice: { $first: '$totalPrice' },
                    createdAt: { $first: '$createdAt' },
                    updatedAt: { $first: '$updatedAt' },
                    items: { $push: '$items' }
                }
            },
            {
                $project: {
                    _id: 0,
                    id: 1,
                    testTime: 1,
                    totalPrice: 1,
                    createdAt: 1,
                    updatedAt: 1,
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
            return res.status(404).json({ message: 'LabOrder not found' });
        }
        res.json(results[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const labOrder = await LabOrder.findOne({ id });
        if (!labOrder) {
            return res.status(404).json({ message: 'LabOrder not found' });
        }

        const { testTime, items } = req.body;
        if (testTime !== undefined) {
            labOrder.testTime = testTime;
        }

        if (Array.isArray(items)) {
            if (items.length === 0) {
                return res.status(400).json({ message: 'items cannot be empty when provided' });
            }

            // Validate items and collect serviceIds
            const serviceIds = [];
            for (const it of items) {
                if (it == null || it.serviceId == null) {
                    return res.status(400).json({ message: 'Each item must include serviceId' });
                }
                serviceIds.push(Number(it.serviceId));
            }

            // Fetch services for enrichment
            const services = await Service.find({ id: { $in: serviceIds } }).lean();
            const serviceById = new Map(services.map(s => [s.id, s]));
            if (serviceById.size !== serviceIds.length) {
                return res.status(400).json({ message: 'One or more services not found' });
            }

            // Replace existing items
            await ServiceInLabOrder.deleteMany({ labOrderId: id });

            let nextSILId = await getNextId(ServiceInLabOrder);
            let total = 0;
            const silDocs = items.map(it => {
                const svc = serviceById.get(Number(it.serviceId));
                const quantity = Number(it.quantity ?? 1);
                const price = Number(it.price ?? svc.price);
                const description = it.description ?? svc.description;
                total += price * quantity;
                return {
                    id: nextSILId++,
                    price,
                    description,
                    quantity,
                    serviceId: svc.id,
                    labOrderId: id
                };
            });

            await ServiceInLabOrder.insertMany(silDocs);
            labOrder.totalPrice = Number(total.toFixed(2));
        } else if (req.body.totalPrice !== undefined) {
            // Optional: allow direct totalPrice update if items not provided
            labOrder.totalPrice = Number(req.body.totalPrice);
        }

        await labOrder.save();

        // Return enriched document like GET /:id
        const [result] = await LabOrder.aggregate([
            { $match: { id } },
            { $lookup: { from: 'serviceinlaborders', localField: 'id', foreignField: 'labOrderId', as: 'items' } },
            { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
            { $lookup: { from: 'services', localField: 'items.serviceId', foreignField: 'id', as: 'service' } },
            { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
            { $addFields: { 'items.service': '$service' } },
            { $group: { _id: '$_id', id: { $first: '$id' }, testTime: { $first: '$testTime' }, totalPrice: { $first: '$totalPrice' }, createdAt: { $first: '$createdAt' }, updatedAt: { $first: '$updatedAt' }, items: { $push: '$items' } } },
            { $project: { _id: 0, id: 1, testTime: 1, totalPrice: 1, createdAt: 1, updatedAt: 1, items: { $filter: { input: '$items', as: 'it', cond: { $ne: ['$$it', null] } } } } }
        ]);

        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const labOrder = await LabOrder.findOneAndDelete({ id });
        if (!labOrder) {
            return res.status(404).json({ message: 'LabOrder not found' });
        }

        await ServiceInLabOrder.deleteMany({ labOrderId: id });
        res.json({ message: 'LabOrder and related services deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;