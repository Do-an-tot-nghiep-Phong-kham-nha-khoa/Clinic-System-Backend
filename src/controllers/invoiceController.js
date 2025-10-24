// filepath: d:\Code Project\Web\DoAn\Clinic-System-Backend\src\controllers\invoiceController.js
const mongoose = require('mongoose');
const Invoice = require('../models/invoice');
const Prescription = require('../models/prescription');
const LabOrder = require('../models/labOrder');
const { getPagingParams, buildMeta, buildSearchFilter } = require('../helpers/query');

// GET /api/invoices
exports.list = async (req, res) => {
    try {
        const { query } = req;
        const paging = getPagingParams(query, { sortBy: '_id', defaultLimit: 20, maxLimit: 200 });

        // Build query conditions
        const conditions = {
            ...(query.id && mongoose.isValidObjectId(query.id) && /^[0-9a-fA-F]{24}$/.test(query.id) && { _id: new mongoose.Types.ObjectId(query.id) }),
            ...(query.patientId && mongoose.isValidObjectId(query.patientId) && { patientId: new mongoose.Types.ObjectId(query.patientId) }),
            ...(query.dateFrom || query.dateTo ? {
                createAt: {
                    ...(query.dateFrom && { $gte: new Date(query.dateFrom) }),
                    ...(query.dateTo && { $lte: new Date(query.dateTo) })
                }
            } : {})
        };

        // Build match for MedicineInPrescription
        const match = query.medicineId && mongoose.isValidObjectId(query.medicineId) ? { medicineId: new mongoose.Types.ObjectId(query.medicineId) } : {};

        // Query with populate
        let dataQuery = Prescription.find(conditions)
            .populate({
                path: 'items',
                match,
                populate: { path: 'medicineId', model: 'Medicine', select: 'name description price manufacturer dosageForm unit expiryDate __v' }
            })
            .lean();

        // Build search conditions
        const searchFields = [
            'items.dosage',
            'items.frequency',
            'items.duration',
            'items.instruction',
            'items.medicineId.name',
            'items.medicineId.manufacturer',
            '_id'
        ];
        const search = buildSearchFilter(query, searchFields);
        if (Object.keys(search).length) {
            dataQuery = dataQuery.where({
                $or: [
                    { 'items.dosage': { $regex: search.$text || '', $options: 'i' } },
                    { 'items.frequency': { $regex: search.$text || '', $options: 'i' } },
                    { 'items.duration': { $regex: search.$text || '', $options: 'i' } },
                    { 'items.instruction': { $regex: search.$text || '', $options: 'i' } },
                    { 'items.medicineId.name': { $regex: search.$text || '', $options: 'i' } },
                    { 'items.medicineId.manufacturer': { $regex: search.$text || '', $options: 'i' } },
                    { _id: { $regex: search.$text || '', $options: 'i' } }
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
            Prescription.countDocuments(conditions)
        ]);

        // Transform response to match desired format
        const filteredData = data.map(prescription => ({
            _id: prescription._id,
            createAt: prescription.createAt,
            patientId: prescription.patientId || null,
            totalPrice: Number(prescription.totalPrice) || 0,
            updatedAt: prescription.updatedAt || null,
            items: Array.isArray(prescription.items) ? prescription.items.map(item => ({
                _id: item._id,
                quantity: item.quantity,
                dosage: item.dosage,
                frequency: item.frequency,
                duration: item.duration,
                instruction: item.instruction,
                medicineId: item.medicineId ? item.medicineId._id : null,
                prescriptionId: item.prescriptionId,
                __v: item.__v || 0,
                medicine: item.medicineId ? {
                    _id: item.medicineId._id,
                    name: item.medicineId.name,
                    description: item.medicineId.description,
                    price: item.medicineId.price,
                    manufacturer: item.medicineId.manufacturer,
                    dosageForm: item.medicineId.dosageForm,
                    unit: item.medicineId.unit,
                    expiryDate: item.medicineId.expiryDate,
                    __v: item.medicineId.__v || 0
                } : null
            })) : []
        }));

        res.json({ data: filteredData, meta: buildMeta(total, paging.page, paging.limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/invoices/:id
exports.get = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }

        const result = await Invoice.findById(id)
            .populate({ path: 'prescriptionId', populate: { path: 'items', populate: { path: 'medicineId', model: 'Medicine', select: 'name description price manufacturer' } } })
            .populate({ path: 'labOrderId', populate: { path: 'items', populate: { path: 'serviceId', model: 'Service', select: 'name description price' } } })
            .lean();

        if (!result) return res.status(404).json({ message: 'Invoice not found' });

        const response = {
            _id: result._id,
            createAt: result.createAt,
            totalPrice: result.totalPrice,
            status: result.status,
            patientId: result.patientId,
            prescription: result.prescriptionId && result.prescriptionId.items
                ? {
                    _id: result.prescriptionId._id,
                    createAt: result.prescriptionId.createAt,
                    totalPrice: result.prescriptionId.totalPrice,
                    items: result.prescriptionId.items.map((item) => ({
                        _id: item._id,
                        quantity: item.quantity,
                        dosage: item.dosage,
                        frequency: item.frequency,
                        duration: item.duration,
                        instruction: item.instruction,
                        medicineId: item.medicineId ? item.medicineId._id : null,
                        prescriptionId: item.prescriptionId,
                        medicine: item.medicineId,
                    })),
                }
                : null,
            labOrder: result.labOrderId && result.labOrderId.items
                ? {
                    _id: result.labOrderId._id,
                    testTime: result.labOrderId.testTime,
                    totalPrice: result.labOrderId.totalPrice,
                    items: result.labOrderId.items.map((item) => ({
                        _id: item._id,
                        quantity: item.quantity,
                        description: item.description,
                        serviceId: item.serviceId ? item.serviceId._id : null,
                        labOrderId: item.labOrderId,
                        service: item.serviceId,
                    })),
                }
                : null,
        };

        res.json(response);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/invoices
exports.create = async (req, res) => {
    try {
        const { createAt = new Date().toISOString(), status = 'Pending', patientId, prescriptionId, labOrderId } = req.body;

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

        const totalPrice = prescriptionTotalPrice + labOrderTotalPrice;

        const invoice = new Invoice({
            createAt,
            totalPrice,
            status,
            patientId,
            prescriptionId: prescriptionId || null,
            labOrderId: labOrderId || null,
        });
        await invoice.save();

        const result = await Invoice.findById(invoice._id)
            .populate({ path: 'prescriptionId', populate: { path: 'items', populate: { path: 'medicineId', model: 'Medicine', select: 'name description price manufacturer' } } })
            .populate({ path: 'labOrderId', populate: { path: 'items', populate: { path: 'serviceId', model: 'Service', select: 'name description price' } } })
            .lean();

        const response = {
            _id: result._id,
            createAt: result.createAt,
            totalPrice: result.totalPrice,
            status: result.status,
            patientId: result.patientId,
            prescription: result.prescriptionId && result.prescriptionId.items
                ? {
                    _id: result.prescriptionId._id,
                    createAt: result.prescriptionId.createAt,
                    totalPrice: result.prescriptionId.totalPrice,
                    items: result.prescriptionId.items.map((item) => ({
                        _id: item._id,
                        quantity: item.quantity,
                        dosage: item.dosage,
                        frequency: item.frequency,
                        duration: item.duration,
                        instruction: item.instruction,
                        medicineId: item.medicineId ? item.medicineId._id : null,
                        prescriptionId: item.prescriptionId,
                        medicine: item.medicineId,
                    })),
                }
                : null,
            labOrder: result.labOrderId && result.labOrderId.items
                ? {
                    _id: result.labOrderId._id,
                    testTime: result.labOrderId.testTime,
                    totalPrice: result.labOrderId.totalPrice,
                    items: result.labOrderId.items.map((item) => ({
                        _id: item._id,
                        quantity: item.quantity,
                        description: item.description,
                        serviceId: item.serviceId ? item.serviceId._id : null,
                        labOrderId: item.labOrderId,
                        service: item.serviceId,
                    })),
                }
                : null,
        };

        res.status(201).json(response);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// PUT /api/invoices/:id
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }

        const update = {};
        const { createAt, status, prescriptionId, labOrderId } = req.body;

        if (createAt) update.createAt = createAt;
        if (status) {
            if (!['Paid', 'Cancelled', 'Pending', 'Refunded'].includes(status)) {
                return res.status(400).json({ message: `Invalid status: ${status}` });
            }
            update.status = status;
        }

        let presId = prescriptionId;
        let labId = labOrderId;
        if (presId === null || presId === '') presId = null;
        if (labId === null || labId === '') labId = null;

        if (presId !== undefined) {
            if (presId && !mongoose.isValidObjectId(presId)) return res.status(400).json({ message: `Invalid prescriptionId: ${presId}` });
            update.prescriptionId = presId;
        }
        if (labId !== undefined) {
            if (labId && !mongoose.isValidObjectId(labId)) return res.status(400).json({ message: `Invalid labOrderId: ${labId}` });
            update.labOrderId = labId;
        }

        // Recompute totalPrice if prescriptionId or labOrderId changed
        let newTotal = undefined;
        if (update.prescriptionId !== undefined || update.labOrderId !== undefined) {
            let pTotal = 0;
            let lTotal = 0;
            const targetPresId = update.prescriptionId === undefined ? (await Invoice.findById(id).select('prescriptionId').lean())?.prescriptionId : update.prescriptionId;
            const targetLabId = update.labOrderId === undefined ? (await Invoice.findById(id).select('labOrderId').lean())?.labOrderId : update.labOrderId;
            if (targetPresId) {
                const p = await Prescription.findById(targetPresId).lean();
                if (!p) return res.status(400).json({ message: `Prescription not found: ${targetPresId}` });
                pTotal = Number(p.totalPrice) || 0;
            }
            if (targetLabId) {
                const l = await LabOrder.findById(targetLabId).lean();
                if (!l) return res.status(400).json({ message: `LabOrder not found: ${targetLabId}` });
                lTotal = Number(l.totalPrice) || 0;
            }
            newTotal = pTotal + lTotal;
            update.totalPrice = newTotal;
        }

        const updated = await Invoice.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
        if (!updated) return res.status(404).json({ message: 'Invoice not found' });

        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// DELETE /api/invoices/:id
exports.remove = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid _id format' });
        }
        const invoice = await Invoice.findByIdAndDelete(id).lean();
        if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
        res.json({ message: 'Invoice deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};