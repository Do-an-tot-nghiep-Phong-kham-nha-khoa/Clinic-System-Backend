const express = require('express');
const router = express.Router();
const LabOrder = require('../models/labOrder');
const ServiceInLabOrder = require('../models/serviceInLabOrder');
const Service = require('../models/service');
const { getPagingParams, buildPipelineStages, buildMeta, buildSearchFilter } = require('../helpers/query');
const mongoose = require('mongoose');

// /api/laborders?page=2&limit=10&sort=-testTime
// /api/laborders?dateFrom=2025-10-01&dateTo=2025-10-31&q=urinalysis
// /api/laborders?serviceId=22&minTotalPrice=100&sortBy=totalPrice&sortOrder=desc
router.get('/', async (req, res) => {
    try {
        const { query } = req;
        const paging = getPagingParams(query, { sortBy: '_id', defaultLimit: 20, maxLimit: 200 });

        // Build query conditions
        const conditions = {
            ...(query.id && { _id: new mongoose.Types.ObjectId(query.id) }),
            ...(query.dateFrom || query.dateTo ? {
                testTime: {
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

        // Build match for ServiceInLabOrder
        const match = query.serviceId ? { serviceId: new mongoose.Types.ObjectId(query.serviceId) } : {};

        // Query with populate
        let dataQuery = LabOrder.find(conditions)
            .populate({
                path: 'items',
                match,
                populate: { path: 'serviceId', model: 'Service', select: 'name description price' }
            })
            .lean();

        // Build search conditions
        const searchFields = ['items.description', 'items.serviceId.name', 'items.serviceId.description'];
        const search = buildSearchFilter(query, searchFields);
        if (Object.keys(search).length) {
            dataQuery = dataQuery.where({
                $or: [
                    { 'items.description': { $regex: search.$text || query.search || '', $options: 'i' } },
                    { 'items.serviceId.name': { $regex: search.$text || query.search || '', $options: 'i' } },
                    { 'items.serviceId.description': { $regex: search.$text || query.search || '', $options: 'i' } }
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
            LabOrder.countDocuments(conditions)
        ]);

        // Filter out invalid items and handle undefined items
        const filteredData = data.map(labOrder => ({
            ...labOrder,
            items: Array.isArray(labOrder.items) ? labOrder.items.filter(item => item && item.serviceId) : []
        }));

        res.json({ data: filteredData, meta: buildMeta(total, paging.page, paging.limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { testTime = new Date().toISOString(), items } = req.body;

        // Validate items
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Items (services) are required' });
        }

        const requiredFields = ['serviceId', 'quantity', 'description'];
        for (const item of items) {
            if (!item || requiredFields.some(field => item[field] == null)) {
                return res.status(400).json({ message: 'Each item must include serviceId, quantity, and description' });
            }
            if (!mongoose.isValidObjectId(item.serviceId)) {
                return res.status(400).json({ message: `Invalid serviceId: ${item.serviceId}` });
            }
        }

        // Verify services exist and get prices
        const serviceIds = items.map(item => new mongoose.Types.ObjectId(item.serviceId));
        const services = await Service.find({ _id: { $in: serviceIds } }).lean();
        if (services.length !== new Set(serviceIds.map(id => id.toString())).size) {
            return res.status(400).json({ message: 'One or more services not found' });
        }

        // Calculate total price
        const servicePriceMap = new Map(services.map(s => [s._id.toString(), s.price || 0]));
        const totalPrice = items.reduce((sum, item) => {
            const price = servicePriceMap.get(item.serviceId.toString()) || 0;
            return sum + (price * Number(item.quantity));
        }, 0);

        // Create lab order
        const labOrder = new LabOrder({ testTime, totalPrice, items: [] });
        await labOrder.save();

        // Create serviceInLabOrder documents
        const silDocs = items.map(item => ({
            labOrderId: labOrder._id,
            serviceId: new mongoose.Types.ObjectId(item.serviceId),
            quantity: Number(item.quantity),
            description: item.description
        }));
        const insertedItems = await ServiceInLabOrder.insertMany(silDocs);

        // Update labOrder with items
        const itemIds = insertedItems.map(doc => doc._id);
        await LabOrder.updateOne({ _id: labOrder._id }, { $set: { items: itemIds } });

        // Fetch enriched lab order
        const result = await LabOrder.findById(labOrder._id)
            .populate({
                path: 'items',
                populate: { path: 'serviceId', model: 'Service', select: 'name description price' }
            })
            .lean();

        if (!result || !result.items || result.items.length === 0) {
            return res.status(500).json({ message: 'Failed to populate items' });
        }

        // Transform response to match desired format
        const response = {
            _id: result._id,
            testTime: result.testTime,
            totalPrice: result.totalPrice,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
            items: result.items.map(item => ({
                _id: item._id,
                quantity: item.quantity,
                description: item.description,
                serviceId: item.serviceId._id,
                labOrderId: item.labOrderId,
                service: {
                    _id: item.serviceId._id,
                    name: item.serviceId.name,
                    description: item.serviceId.description,
                    price: item.serviceId.price
                }
            }))
        };

        res.status(201).json(response);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;