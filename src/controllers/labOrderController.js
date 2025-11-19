const mongoose = require('mongoose');
const LabOrder = require('../models/labOrder');
const Service = require('../models/service');
const { getPagingParams, buildMeta } = require('../helpers/query');
const HealthProfile = require('../models/healthProfile');
const Patient = require('../models/patient');
const FamilyMember = require('../models/familyMember');

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

        const finalFilter = { ...conditions, ...itemMatch };

        // Base query with populate
        let dataQuery = LabOrder.find({ ...conditions, ...itemMatch })
            .populate({
                path: 'items.serviceId',
                model: 'Service',
                select: 'name description price',
            })
            .populate({
                path: 'healthProfile_id',
                model: 'HealthProfile',
                select: 'ownerId ownerModel'
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

        // Resolve owner details in parallel for performance
        const resolved = await Promise.all(data.map(async (lo) => {
            const hp = lo.healthProfile_id;
            let owner_detail = null;

            if (hp && hp.ownerId && hp.ownerModel) {
                // choose model
                if (hp.ownerModel === 'Patient') {
                    const p = await Patient.findById(hp.ownerId).select('name dob phone gender').lean();
                    if (p) owner_detail = { name: p.name, dob: p.dob, phone: p.phone, gender: p.gender };
                } else if (hp.ownerModel === 'FamilyMember') {
                    const fm = await FamilyMember.findById(hp.ownerId).select('name dob phone gender').lean();
                    if (fm) owner_detail = { name: fm.name, dob: fm.dob, phone: fm.phone, gender: fm.gender };
                }
            }

            return {
                _id: lo._id,
                testTime: lo.testTime,
                totalPrice: lo.totalPrice,
                healthProfile_id: hp?._id || null,
                owner_detail, // null nếu không tìm được
                items: Array.isArray(lo.items) ? lo.items.filter(it => it && it.serviceId).map(item => ({
                    quantity: item.quantity,
                    description: item.description,
                    serviceId: item.serviceId?._id || null,
                    service: item.serviceId ? {
                        _id: item.serviceId._id,
                        name: item.serviceId.name,
                        description: item.serviceId.description,
                        price: item.serviceId.price
                    } : null
                })) : []
            };
        }));

        res.json({ data: resolved, meta: buildMeta(total, paging.page, paging.limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/laborders/:id
exports.getById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid labOrder ID' });
        }

        const labOrder = await LabOrder.findById(id)
            .populate({
                path: 'items.serviceId',
                model: 'Service',
                select: 'name description price',
            })
            .populate({
                path: 'healthProfile_id',
                model: 'HealthProfile',
                select: 'ownerId ownerModel'
            })
            .lean();

        if (!labOrder) {
            return res.status(404).json({ message: 'Lab Order not found' });
        }

        // Resolve owner_detail like list
        let owner_detail = null;
        const hp = labOrder.healthProfile_id;
        if (hp && hp.ownerId && hp.ownerModel) {
            if (hp.ownerModel === 'Patient') {
                const p = await Patient.findById(hp.ownerId).select('name dob phone gender').lean();
                if (p) owner_detail = { name: p.name, dob: p.dob, phone: p.phone, gender: p.gender };
            } else if (hp.ownerModel === 'FamilyMember') {
                const fm = await FamilyMember.findById(hp.ownerId).select('name dob phone gender').lean();
                if (fm) owner_detail = { name: fm.name, dob: fm.dob, phone: fm.phone, gender: fm.gender };
            }
        }

        const response = {
            _id: labOrder._id,
            testTime: labOrder.testTime,
            totalPrice: labOrder.totalPrice,
            healthProfile_id: hp?._id || null,
            owner_detail,
            items: Array.isArray(labOrder.items) ? labOrder.items.filter(it => it && it.serviceId).map(item => ({
                quantity: item.quantity,
                description: item.description,
                serviceId: item.serviceId?._id || null,
                service: item.serviceId ? {
                    _id: item.serviceId._id,
                    name: item.serviceId.name,
                    description: item.serviceId.description,
                    price: item.serviceId.price
                } : null
            })) : []
        };

        res.json(response);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/laborders
exports.create = async (req, res) => {
    try {
        const { testTime = new Date().toISOString(), items, healthProfile_id } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Items (services) are required' });
        }

        if (!healthProfile_id) {
            return res.status(400).json({ message: 'healthProfile_id is required' });
        }
        if (!mongoose.isValidObjectId(healthProfile_id)) {
            return res.status(400).json({ message: `Invalid healthProfile_id format: ${healthProfile_id}` });
        }

        // verify health profile existence
        const hp = await HealthProfile.findById(healthProfile_id).lean();
        if (!hp) return res.status(404).json({ message: "Health Profile not found" });

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
            healthProfile_id: new mongoose.Types.ObjectId(healthProfile_id)
        });
        await labOrder.save();

        // Populate the embedded items' serviceId
        const result = await LabOrder.findById(labOrder._id)
            .populate('items.serviceId', 'name description price')
            .populate('healthProfile_id', 'ownerId ownerModel')
            .lean();

        if (!result || !Array.isArray(result.items)) {
            return res.status(500).json({ message: 'Failed to populate items' });
        }

        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};