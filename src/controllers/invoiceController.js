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
        const paging = getPagingParams(query, { sortBy: 'created_at', sortOrder: 'desc', defaultLimit: 20, maxLimit: 200 });

        // Build query conditions cho Invoice
        const conditions = {
            // Tìm kiếm theo _id, patientId, created_at
            ...(query.id && mongoose.isValidObjectId(query.id) && /^[0-9a-fA-F]{24}$/.test(query.id) && { _id: new mongoose.Types.ObjectId(query.id) }),
            ...(query.patientId && mongoose.isValidObjectId(query.patientId) && { patientId: new mongoose.Types.ObjectId(query.patientId) }),
            ...(query.dateFrom || query.dateTo ? {
                created_at: {
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
                select: 'created_at totalPrice items patientId',
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
            created_at: invoice.created_at,
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
                created_at: invoice.prescriptionId.created_at,
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

// POST /api/invoices
exports.create = async (req, res) => {
    const patientIdFromReq = req.body.patientId ? String(req.body.patientId) : null;

    try {
        const { created_at = new Date().toISOString(), status = 'Pending', patientId, prescriptionId, labOrderId } = req.body;

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
            totalPrice,
            status,
            patientId,
            created_at: new Date(created_at),
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
            created_at: result.created_at,
            totalPrice: result.totalPrice,
            status: result.status,
            patientId: result.patientId,
            prescription: result.prescriptionId && result.prescriptionId.items
                ? {
                    _id: result.prescriptionId._id,
                    created_at: result.prescriptionId.created_at,
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

// GET /api/invoices/patient?patientId=
exports.getByPatient = async (req, res) => {
    try {
        const { patientId } = req.query;

        // 1. Kiểm tra tính hợp lệ của patientId
        if (!patientId || !mongoose.isValidObjectId(patientId)) {
            return res.status(400).json({ message: 'Valid patientId is required' });
        }

        const patientObjectId = new mongoose.Types.ObjectId(patientId);

        // 2. Truy vấn Invoice dựa trên patientId và populate chi tiết
        const invoices = await Invoice.find({ patientId: patientObjectId })
            .sort({ created_at: -1 }) // Sắp xếp theo ngày tạo mới nhất lên trước
            .populate('patientId', 'name phone dob address gender') // Thông tin bệnh nhân
            .populate({
                path: 'prescriptionId',
                select: 'created_at totalPrice items patientId',
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
            .lean();

        // 3. Format dữ liệu trả về
        const transformedData = invoices.map(invoice => ({
            _id: invoice._id,
            created_at: invoice.created_at,
            totalPrice: Number(invoice.totalPrice) || 0,
            status: invoice.status,

            // Thông tin bệnh nhân đã populate
            patient: invoice.patientId ? {
                _id: invoice.patientId._id,
                name: invoice.patientId.name,
                phone: invoice.patientId.phone,
            } : null,
            patientId: invoice.patientId ? invoice.patientId._id : null,

            // Chi tiết Prescription
            prescription: invoice.prescriptionId ? {
                _id: invoice.prescriptionId._id,
                created_at: invoice.prescriptionId.created_at,
                totalPrice: Number(invoice.prescriptionId.totalPrice) || 0,
                items: Array.isArray(invoice.prescriptionId.items) ? invoice.prescriptionId.items.map(item => ({
                    _id: item._id, medicineId: item.medicineId ? item.medicineId._id : null, medicine: item.medicineId,
                })) : []
            } : null,

            // Chi tiết LabOrder
            labOrder: invoice.labOrderId ? {
                _id: invoice.labOrderId._id, testTime: invoice.labOrderId.testTime, totalPrice: Number(invoice.labOrderId.totalPrice) || 0,
                items: Array.isArray(invoice.labOrderId.items) ? invoice.labOrderId.items.map(item => ({
                    _id: item._id, quantity: item.quantity, serviceId: item.serviceId ? item.serviceId._id : null, service: item.serviceId,
                })) : []
            } : null,
        }));

        res.json({ data: transformedData });

    } catch (error) {
        console.error("Error fetching invoices by patient ID:", error);
        res.status(500).json({ message: error.message });
    }
};

// GET /api/invoices/:id
exports.getById = async (req, res) => {
    try {
        // Lấy ID hóa đơn từ URL params (giả sử route là /invoices/:id)
        const invoiceId = req.params.id;

        // 1. Kiểm tra tính hợp lệ của Invoice ID
        if (!invoiceId || !mongoose.isValidObjectId(invoiceId)) {
            return res.status(400).json({ message: 'Valid Invoice ID is required' });
        }

        const invoice = await Invoice.findById(invoiceId)
            // Populate Patient (thông tin cơ bản)
            .populate('patientId', 'name phone dob address gender')
            // Populate Prescription
            .populate({
                path: 'prescriptionId',
                select: 'created_at totalPrice items patientId',
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
            // Populate LabOrder
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
            .lean();

        // 2. Kiểm tra nếu không tìm thấy hóa đơn
        if (!invoice) {
            return res.status(404).json({ message: `Invoice not found with ID: ${invoiceId}` });
        }

        // 3. Format dữ liệu trả về (tương tự như hàm list)
        const response = {
            _id: invoice._id,
            created_at: invoice.created_at,
            totalPrice: Number(invoice.totalPrice) || 0,
            status: invoice.status,

            // Thông tin bệnh nhân đã populate
            patient: invoice.patientId ? {
                _id: invoice.patientId._id,
                name: invoice.patientId.name,
                phone: invoice.patientId.phone,
                dob: invoice.patientId.dob,
                address: invoice.patientId.address,
                gender: invoice.patientId.gender,
            } : null,
            patientId: invoice.patientId ? invoice.patientId._id : null,

            // Chi tiết Prescription
            prescription: invoice.prescriptionId ? {
                _id: invoice.prescriptionId._id,
                created_at: invoice.prescriptionId.created_at,
                totalPrice: Number(invoice.prescriptionId.totalPrice) || 0,
                patientId: invoice.prescriptionId.patientId,
                items: Array.isArray(invoice.prescriptionId.items) ? invoice.prescriptionId.items.map(item => ({
                    _id: item._id, quantity: item.quantity, medicineId: item.medicineId ? item.medicineId._id : null, medicine: item.medicineId,
                })) : []
            } : null,

            // Chi tiết LabOrder
            labOrder: invoice.labOrderId ? {
                _id: invoice.labOrderId._id, testTime: invoice.labOrderId.testTime, totalPrice: Number(invoice.labOrderId.totalPrice) || 0,
                patientId: invoice.labOrderId.patientId,
                items: Array.isArray(invoice.labOrderId.items) ? invoice.labOrderId.items.map(item => ({
                    _id: item._id, quantity: item.quantity, serviceId: item.serviceId ? item.serviceId._id : null, service: item.serviceId,
                })) : []
            } : null,
        };

        res.json(response);

    } catch (error) {
        console.error("Error fetching invoice by ID:", error);
        res.status(500).json({ message: error.message });
    }
};

// PATCH /api/invoices/:id/status
exports.updateStatus = async (req, res) => {
    try {
        const invoiceId = req.params.id;
        const { status } = req.body;

        // 1. Kiểm tra tính hợp lệ của Invoice ID
        if (!invoiceId || !mongoose.isValidObjectId(invoiceId)) {
            return res.status(400).json({ message: 'Valid Invoice ID is required' });
        }

        // 2. Kiểm tra tính hợp lệ của Status
        const validStatuses = ['Paid', 'Cancelled', 'Pending', 'Refunded'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                message: `Invalid status provided. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        // 3. Cập nhật Status trong cơ sở dữ liệu
        const updatedInvoice = await Invoice.findByIdAndUpdate(
            invoiceId,
            { status: status },
            { new: true, runValidators: true } // {new: true} trả về tài liệu sau khi update
        )
            .populate('patientId', 'name phone dob address gender') // Populate chi tiết patient cho response
            .lean();

        // 4. Kiểm tra nếu không tìm thấy hóa đơn
        if (!updatedInvoice) {
            return res.status(404).json({ message: `Invoice not found with ID: ${invoiceId}` });
        }

        // 5. Format dữ liệu trả về (chỉ cần các trường chính, bao gồm Patient)
        const response = {
            _id: updatedInvoice._id,
            created_at: updatedInvoice.created_at,
            totalPrice: Number(updatedInvoice.totalPrice) || 0,
            status: updatedInvoice.status,
            patientId: updatedInvoice.patientId ? updatedInvoice.patientId._id : null,
            patient: updatedInvoice.patientId ? {
                _id: updatedInvoice.patientId._id,
                name: updatedInvoice.patientId.name,
                phone: updatedInvoice.patientId.phone,
                // ... (Các trường khác của patient)
            } : null,
            prescriptionId: updatedInvoice.prescriptionId || null,
            labOrderId: updatedInvoice.labOrderId || null,
        };

        res.json(response);

    } catch (error) {
        console.error("Error updating invoice status:", error);
        res.status(500).json({ message: error.message });
    }
};