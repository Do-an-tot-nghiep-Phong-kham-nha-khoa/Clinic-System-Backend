const express = require('express');
const router = express.Router();
const Invoice = require('../models/invoice');

router.get('/', async (req, res) => {
    try {
        const invoices = await Invoice.find();
        res.json(invoices);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ id: req.params.id });
        if (invoice) {
            res.json(invoice);
        } else {
            res.status(404).json({ message: 'Invoice not found' });
        }
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