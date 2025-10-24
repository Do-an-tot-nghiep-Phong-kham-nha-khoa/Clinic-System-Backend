const express = require('express');
const router = express.Router();
const Service = require('../models/service');
const { getPagingParams, applyPagingAndSortingToQuery, buildMeta, buildSearchFilter } = require('../helpers/query');
const mongoose = require('mongoose');

// /api/services?page=2&limit=10&sort=-price
// /api/services?q=teeth&minPrice=20&maxPrice=100
router.get('/', async (req, res) => {
    try {
        const paging = getPagingParams(req.query, { sortBy: '_id', defaultLimit: 20, maxLimit: 200 });

        // Build filter
        const filter = {};
        // Search across name and description via ?q=
        const search = buildSearchFilter(req.query, ['name', 'description']);
        if (search.$or) filter.$or = search.$or;
        // Optional filter by _id via query string
        if (req.query._id && mongoose.Types.ObjectId.isValid(req.query._id)) {
            filter._id = new mongoose.Types.ObjectId(req.query._id);
        }
        // Price range
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
});

router.post('/', async (req, res) => {
    try {
        // Create without custom id; MongoDB will generate _id
        const service = new Service({
            name: req.body.name,
            price: req.body.price,
            description: req.body.description
        });
        const newService = await service.save();
        res.status(201).json(newService);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const service = await Service.findById(id).lean();
        if (service) {
            res.json(service);
        } else {
            res.status(404).json({ message: 'Service not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const service = await Service.findById(id);
        if (service) {
            service.name = req.body.name ?? service.name;
            service.price = req.body.price ?? service.price;
            service.description = req.body.description ?? service.description;
            const updatedService = await service.save();
            res.json(updatedService);
        } else {
            res.status(404).json({ message: 'Service not found' });
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
        const service = await Service.findByIdAndDelete(id);
        if (service) {
            res.json({ message: 'Service deleted' });
        } else {
            res.status(404).json({ message: 'Service not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;