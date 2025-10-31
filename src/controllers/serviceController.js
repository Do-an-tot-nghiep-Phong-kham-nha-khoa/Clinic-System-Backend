const Service = require('../models/service');
const mongoose = require('mongoose');
const { getPagingParams, applyPagingAndSortingToQuery, buildMeta, buildSearchFilter } = require('../helpers/query');

// GET /api/services
exports.list = async (req, res) => {
    try {
        const paging = getPagingParams(req.query, { sortBy: '_id', defaultLimit: 20, maxLimit: 200 });

        const filter = {};
        const search = buildSearchFilter(req.query, ['name', 'description']);
        if (search.$or) filter.$or = search.$or;

        if (req.query._id && mongoose.Types.ObjectId.isValid(req.query._id)) {
            filter._id = new mongoose.Types.ObjectId(req.query._id);
        }

        if (req.query.minPrice || req.query.maxPrice) {
            filter.price = {};
            if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
            if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
        }

        const total = await Service.countDocuments(filter);
        const query = applyPagingAndSortingToQuery(Service.find(filter), paging);
        const items = await query.lean();
        res.json({ data: items, meta: buildMeta(total, paging.page, paging.limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/services
exports.create = async (req, res) => {
    try {
        const service = new Service({
            name: req.body.name,
            price: req.body.price,
            description: req.body.description,
            created_at: new Date()
        });
        const newService = await service.save();
        res.status(201).json(newService);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// GET /api/services/:id
exports.get = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const service = await Service.findById(id).lean();
        if (!service) return res.status(404).json({ message: 'Service not found' });
        res.json(service);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT /api/services/:id
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const service = await Service.findById(id);
        if (!service) return res.status(404).json({ message: 'Service not found' });

        service.name = req.body.name ?? service.name;
        service.price = req.body.price ?? service.price;
        service.description = req.body.description ?? service.description;

        const updated = await service.save();
        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// DELETE /api/services/:id
exports.remove = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const service = await Service.findByIdAndDelete(id);
        if (!service) return res.status(404).json({ message: 'Service not found' });
        res.json({ message: 'Service deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};