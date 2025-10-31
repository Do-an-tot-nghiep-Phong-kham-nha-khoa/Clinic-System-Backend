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
        // Sử dụng getPagingParams
        const paging = getPagingParams(query, { sortBy: 'createAt', sortOrder: 'desc', defaultLimit: 20, maxLimit: 200 });

        // Build query conditions cho Invoice
        const conditions = {
            // Tìm kiếm theo _id, patientId, createAt
            ...(query.id && mongoose.isValidObjectId(query.id) && /^[0-9a-fA-F]{24}$/.test(query.id) && { _id: new mongoose.Types.ObjectId(query.id) }),
            ...(query.patientId && mongoose.isValidObjectId(query.patientId) && { patientId: new mongoose.Types.ObjectId(query.patientId) }),
            ...(query.dateFrom || query.dateTo ? {
                createAt: {
                    ...(query.dateFrom && { $gte: new Date(query.dateFrom) }),
                    ...(query.dateTo && { $lte: new Date(query.dateTo) })
                }
            } : {}),
            // Thêm điều kiện tìm kiếm theo status nếu cần
            ...(query.status && { status: query.status })
        };

        // 1. Tạo Query với Populate
        let dataQuery = Invoice.find(conditions)
            // 2. **Populate các trường liên quan**
            .populate({
                path: 'prescriptionId',
                select: 'createAt totalPrice items patientId',
                populate: {
                    path: 'items',
                    select: 'quantity medicineId',
                    populate: {
                        path: 'medicineId',
                        model: 'Medicine',
                        select: 'name price'
                    }
                }
            })
            .populate({
                path: 'labOrderId',
                select: 'testTime totalPrice items patientId',
                populate: {
                    path: 'items',
                    select: 'quantity serviceId',
                    populate: {
                        path: 'serviceId',
                        model: 'Service',
                        select: 'name price'
                    }
                }
            })
            .populate('patientId', 'name phone')
            .lean(); // Luôn sử dụng .lean() để tăng hiệu suất

        const searchFields = ['_id', 'status']; // Có thể thêm các trường khác của Invoice
        const search = buildSearchFilter(query, searchFields);

        if (Object.keys(search).length && search.$or) {
            // Áp dụng điều kiện tìm kiếm trực tiếp cho Invoice
            dataQuery = dataQuery.where(search);
        }

        // 3. **Áp dụng Sorting và Paging** 
        dataQuery = dataQuery
            // Sử dụng paging.sort 
            .sort(paging.sort)
            .skip(paging.skip)
            .limit(paging.limit);

        // 4. Execute queries in parallel
        const [data, total] = await Promise.all([
            dataQuery.exec(),
            // Count tổng số bản ghi khớp điều kiện
            Invoice.countDocuments(conditions)
        ]);

        // 5. Transform response to match desired format
        const transformedData = data.map(invoice => ({
            _id: invoice._id,
            createAt: invoice.createAt,
            totalPrice: Number(invoice.totalPrice) || 0,
            status: invoice.status,

            patient: invoice.patientId ? {
                name: invoice.patientId.name,
                phone: invoice.patientId.phone,
            } : null,
            // Giữ lại patientId gốc (chỉ ID) nếu cần
            patientId: invoice.patientId ? invoice.patientId._id : null,

            // Format Prescription data
            prescription: invoice.prescriptionId ? {
                _id: invoice.prescriptionId._id,
                createAt: invoice.prescriptionId.createAt,
                totalPrice: Number(invoice.prescriptionId.totalPrice) || 0,
                patientId: invoice.prescriptionId.patientId,
                items: Array.isArray(invoice.prescriptionId.items) ? invoice.prescriptionId.items.map(item => ({
                    _id: item._id,
                    medicineId: item.medicineId ? item.medicineId._id : null,
                    medicine: item.medicineId,
                })) : []
            } : null,

            // Format LabOrder data
            labOrder: invoice.labOrderId ? {
                _id: invoice.labOrderId._id,
                testTime: invoice.labOrderId.testTime,
                totalPrice: Number(invoice.labOrderId.totalPrice) || 0,
                patientId: invoice.labOrderId.patientId,
                items: Array.isArray(invoice.labOrderId.items) ? invoice.labOrderId.items.map(item => ({
                    _id: item._id,
                    quantity: item.quantity,
                    serviceId: item.serviceId ? item.serviceId._id : null,
                    service: item.serviceId,
                })) : []
            } : null,
        }));

        res.json({ data: transformedData, meta: buildMeta(total, paging.page, paging.limit) });
    } catch (error) {
        console.error("Error fetching invoices:", error);
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
    const patientIdFromReq = req.body.patientId ? String(req.body.patientId) : null;

    try {
        const { createAt = new Date().toISOString(), status = 'Pending', patientId, prescriptionId, labOrderId } = req.body;

        // 1. Kiểm tra tính hợp lệ ban đầu
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

        // 2. Kiểm tra Prescription và Patient ID
        if (prescriptionId) {
            // Lấy cả totalPrice và patientId từ Prescription
            const prescription = await Prescription.findById(prescriptionId).select('totalPrice patientId').lean();
            if (!prescription) {
                return res.status(400).json({ message: `Prescription not found: ${prescriptionId}` });
            }

            // So sánh Patient ID
            if (String(prescription.patientId) !== patientIdFromReq) {
                return res.status(400).json({
                    message: `Patient ID mismatch: Prescription ${prescriptionId} belongs to patient ${prescription.patientId}, not ${patientIdFromReq}`
                });
            }

            prescriptionTotalPrice = Number(prescription.totalPrice) || 0;
            if (isNaN(prescriptionTotalPrice) || prescriptionTotalPrice < 0) {
                return res.status(400).json({ message: `Invalid totalPrice for prescription: ${prescriptionId}` });
            }
        }

        // 3. Kiểm tra LabOrder và Patient ID
        if (labOrderId) {
            // Lấy cả totalPrice và patientId từ LabOrder
            const labOrder = await LabOrder.findById(labOrderId).select('totalPrice patientId').lean();
            if (!labOrder) {
                return res.status(400).json({ message: `LabOrder not found: ${labOrderId}` });
            }

            // So sánh Patient ID
            if (String(labOrder.patientId) !== patientIdFromReq) {
                return res.status(400).json({
                    message: `Patient ID mismatch: LabOrder ${labOrderId} belongs to patient ${labOrder.patientId}, not ${patientIdFromReq}`
                });
            }

            labOrderTotalPrice = Number(labOrder.totalPrice) || 0;
            if (isNaN(labOrderTotalPrice) || labOrderTotalPrice < 0) {
                return res.status(400).json({ message: `Invalid totalPrice for labOrder: ${labOrderId}` });
            }
        }

        // 4. Tạo Invoice

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

        // 5. Populate và trả về kết quả
        // Giữ nguyên phần populate và response để đảm bảo đầu ra không thay đổi
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
        // Xử lý lỗi Mongoose, v.v.
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