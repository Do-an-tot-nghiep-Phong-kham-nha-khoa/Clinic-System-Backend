const express = require('express');
const router = express.Router();
const LabOrder = require('../models/labOrder');
const ServiceInLabOrder = require('../models/serviceInLabOrder');
const Service = require('../models/service');

// Helper to generate next incremental id per collection
async function getNextId(Model) {
    const maxDoc = await Model.findOne().sort({ id: -1 }).select('id');
    return (maxDoc?.id ?? 0) + 1;
}

router.get('/', async (req, res) => {
    try {
        // Enrich lab orders with their items (ServiceInLabOrder) and each item's Service details
        const results = await LabOrder.aggregate([
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
        res.json(results);
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