const express = require('express');
const router = express.Router();
const Service = require('../models/service');

router.get('/', async (req, res) => {
    try {
        const services = await Service.find();
        res.json(services);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', async (req, res) => {
    const service = new Service({
        id: req.body.id,
        name: req.body.name,
        price: req.body.price,
        description: req.body.description
    });
    try {
        const newService = await service.save();
        res.status(201).json(newService);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const service = await Service.findOne({ id: req.params.id });
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
        const service = await Service.findOne({ id: req.params.id });
        if (service) {
            service.name = req.body.name || service.name;
            service.price = req.body.price || service.price;
            service.description = req.body.description || service.description;
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
        const service = await Service.findOneAndDelete({ id: req.params.id });
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