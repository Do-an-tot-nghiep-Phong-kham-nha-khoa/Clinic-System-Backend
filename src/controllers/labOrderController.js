const mongoose = require('mongoose');
const LabOrder = require('../models/labOrder');
const Service = require('../models/service');
const { getPagingParams, buildMeta } = require('../helpers/query');

// GET /api/laborders
exports.list = async (req, res) => {
    try {
        const { query } = req;
        const paging = getPagingParams(query, { sortBy: '_id', defaultLimit: 20, maxLimit: 200 });

        // Build query conditions
        const conditions = {
            ...(query.id && mongoose.isValidObjectId(query.id) && { _id: new mongoose.Types.ObjectId(query.id) }),
            ...(query.dateFrom || query.dateTo
                ? {
                    testTime: {
                        ...(query.dateFrom && { $gte: new Date(query.dateFrom) }),
                        ...(query.dateTo && { $lte: new Date(query.dateTo) }),
                    },
                }
                : {}),
            ...(query.minTotalPrice || query.maxTotalPrice
                ? {
                    totalPrice: {
                        ...(query.minTotalPrice && { $gte: Number(query.minTotalPrice) }),
                        ...(query.maxTotalPrice && { $lte: Number(query.maxTotalPrice) }),
                    },
                }
                : {}),
        };

        // Match for items.serviceId
        const itemMatch = query.serviceId && mongoose.isValidObjectId(query.serviceId)
            ? { 'items.serviceId': new mongoose.Types.ObjectId(query.serviceId) }
            : {};

        // Base query with populate
        let dataQuery = LabOrder.find({ ...conditions, ...itemMatch })
            .populate({
                path: 'items.serviceId',
                model: 'Service',
                select: 'name description price',
            })
            .lean();

        // Simple text search across item description and service fields
        if (query.q && String(query.q).trim()) {
            const q = String(query.q).trim();
            dataQuery = dataQuery.where({
                $or: [
                    { 'items.description': { $regex: q, $options: 'i' } },
                    { 'items.serviceId.name': { $regex: q, $options: 'i' } },
                    { 'items.serviceId.description': { $regex: q, $options: 'i' } },
                ],
            });
        }

        // Apply sort and paging
        const sort = paging.sort;
        dataQuery = dataQuery.sort(sort).skip(paging.skip).limit(paging.limit);

        const [data, total] = await Promise.all([
            dataQuery.exec(),
            LabOrder.countDocuments(conditions),
        ]);

        const filteredData = data.map((lo) => ({
            ...lo,
            items: Array.isArray(lo.items) ? lo.items.filter((it) => it && it.serviceId) : [],
        }));

        res.json({ data: filteredData, meta: buildMeta(total, paging.page, paging.limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/laborders
exports.create = async (req, res) => {
    try {
        const { testTime = new Date().toISOString(), items, patientId } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Items (services) are required' });
        }

        if (!patientId) { // Kiểm tra patientId
            return res.status(400).json({ message: 'Patient ID is required' });
        }
        if (!mongoose.isValidObjectId(patientId)) { // Kiểm tra tính hợp lệ của ObjectId
            return res.status(400).json({ message: `Invalid Patient ID format: ${patientId}` });
        }

        const required = ['serviceId', 'quantity'];
        for (const item of items) {
            if (!item || required.some((k) => item[k] == null)) {
                return res.status(400).json({ message: 'Each item must include serviceId and quantity' });
            }
            if (!mongoose.isValidObjectId(item.serviceId)) {
                return res.status(400).json({ message: `Invalid serviceId: ${item.serviceId}` });
            }
        }
        // Verify services and map prices
        const serviceIds = items.map((i) => new mongoose.Types.ObjectId(i.serviceId));
        const services = await Service.find({ _id: { $in: serviceIds } }).lean();
        const foundIds = new Set(services.map((s) => s._id.toString()));
        if (foundIds.size !== new Set(serviceIds.map((id) => id.toString())).size) {
            return res.status(400).json({ message: 'One or more services not found' });
        }
        const priceMap = new Map(services.map((s) => [s._id.toString(), s.price || 0]));
        const totalPrice = items.reduce((sum, it) => sum + (priceMap.get(String(it.serviceId)) || 0) * Number(it.quantity), 0);
        // Prepare items for embedding
        const formattedItems = items.map((it) => ({
            serviceId: new mongoose.Types.ObjectId(it.serviceId),
            quantity: Number(it.quantity),
            description: it.description || undefined // Include description only if provided
        }));
        // Create and save the LabOrder with embedded items
        const labOrder = new LabOrder({
            testTime,
            totalPrice,
            items: formattedItems,
            patientId: new mongoose.Types.ObjectId(patientId) // Thêm patientId đã chuyển đổi thành ObjectId
        });
        await labOrder.save();
        // Populate the embedded items' serviceId
        const result = await LabOrder.findById(labOrder._id)
            .populate('items.serviceId', 'name description price')
            .lean();

        if (!result || !Array.isArray(result.items)) {
            return res.status(500).json({ message: 'Failed to populate items' });
        }
        // Format the response
        const response = {
            _id: result._id,
            testTime: result.testTime,
            totalPrice: result.totalPrice,
            createdAt: result.createdAt,
            patientId: result.patientId,
            items: result.items.filter(Boolean).map((item) => ({
                quantity: item.quantity,
                description: item.description,
                serviceId: item.serviceId?._id,
                service: item.serviceId && {
                    _id: item.serviceId._id,
                    name: item.serviceId.name,
                    description: item.serviceId.description,
                    price: item.serviceId.price,
                },
            })),
        };
        res.status(201).json(response);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};