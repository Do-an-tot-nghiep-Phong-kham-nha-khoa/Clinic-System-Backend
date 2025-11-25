const mongoose = require('mongoose');
const Invoice = require('../models/invoice');
const Prescription = require('../models/prescription');
const LabOrder = require('../models/labOrder');
const { getPagingParams, buildMeta, buildSearchFilter } = require('../helpers/query');
const HealthProfile = require('../models/healthProfile');
const Patient = require('../models/patient');
const FamilyMember = require('../models/familyMember');

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
            ...(query.healthProfile_id && mongoose.isValidObjectId(query.healthProfile_id) && { healthProfile_id: new mongoose.Types.ObjectId(query.healthProfile_id) }),
            ...(query.dateFrom || query.dateTo ? {
                created_at: {
                    ...(query.dateFrom && { $gte: new Date(query.dateFrom) }),
                    ...(query.dateTo && { $lte: new Date(query.dateTo) })
                }
            } : {}),
            // Thêm điều kiện tìm kiếm theo status nếu cần
            ...(query.status && { status: query.status })
        };

        // Handle search by patient name
        let searchConditions = conditions;
        if (query.q && query.q.trim()) {
            const searchTerm = query.q.trim();
            // Tìm patients và family members có tên chứa searchTerm
            const [patients, familyMembers] = await Promise.all([
                Patient.find({ name: { $regex: searchTerm, $options: 'i' } }).select('_id').lean(),
                FamilyMember.find({ name: { $regex: searchTerm, $options: 'i' } }).select('_id').lean()
            ]);

            const patientIds = patients.map(p => p._id);
            const familyMemberIds = familyMembers.map(fm => fm._id);

            // Tìm health profiles tương ứng
            const healthProfiles = await HealthProfile.find({
                $or: [
                    { ownerModel: 'Patient', ownerId: { $in: patientIds } },
                    { ownerModel: 'FamilyMember', ownerId: { $in: familyMemberIds } }
                ]
            }).select('_id').lean();

            const healthProfileIds = healthProfiles.map(hp => hp._id);

            // Thêm điều kiện search vào conditions
            searchConditions = {
                ...conditions,
                healthProfile_id: { $in: healthProfileIds }
            };
        }

        // 1. Tạo Query với Populate
        let dataQuery = Invoice.find(searchConditions)
            // 2. **Populate các trường liên quan**
            .populate({
                path: 'prescriptionId',
                select: 'totalPrice items',
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
                select: 'totalPrice items',
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
            .populate({
                path: 'healthProfile_id',
                model: 'HealthProfile',
                select: 'ownerId ownerModel'
            })
            .lean(); // Luôn sử dụng .lean() để tăng hiệu suất

        // 3. **Áp dụng Sorting và Paging** 
        dataQuery = dataQuery
            // Sử dụng paging.sort 
            .sort(paging.sort)
            .skip(paging.skip)
            .limit(paging.limit);        // 4. Execute queries in parallel
        const [data, total] = await Promise.all([
            dataQuery.exec(),
            // Count tổng số bản ghi khớp điều kiện (sử dụng searchConditions thay vì conditions)
            Invoice.countDocuments(searchConditions)
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
                created_at: lo.created_at,
                totalPrice: Number(lo.totalPrice) || 0,
                status: lo.status,
                healthProfile_id: hp?._id || null,
                owner_detail,

                // Format Prescription data
                prescription: lo.prescriptionId ? {
                    _id: lo.prescriptionId._id,
                    totalPrice: Number(lo.prescriptionId.totalPrice) || 0,
                    items: Array.isArray(lo.prescriptionId.items) ? lo.prescriptionId.items.map(item => ({
                        _id: item._id,
                        medicineId: item.medicineId ? item.medicineId._id : null,
                        medicine: item.medicineId,
                    })) : []
                } : null,

                // Format LabOrder data
                labOrder: lo.labOrderId ? {
                    _id: lo.labOrderId._id,
                    totalPrice: Number(lo.labOrderId.totalPrice) || 0,
                    items: Array.isArray(lo.labOrderId.items) ? lo.labOrderId.items.map(item => ({
                        _id: item._id,
                        quantity: item.quantity,
                        serviceId: item.serviceId ? item.serviceId._id : null,
                        service: item.serviceId,
                    })) : []
                } : null,
            };
        }));

        res.json({ data: resolved, meta: buildMeta(total, paging.page, paging.limit) });
    } catch (error) {
        console.error("Error fetching invoices:", error);
        res.status(500).json({ message: error.message });
    }
};

// POST /api/invoices
exports.create = async (req, res) => {
    try {
        const { created_at = new Date().toISOString(), status = 'Pending', healthProfile_id, prescriptionId, labOrderId } = req.body;

        // 1. Kiểm tra tính hợp lệ ban đầu
        if (!healthProfile_id || !mongoose.isValidObjectId(healthProfile_id)) {
            return res.status(400).json({ message: 'Valid healthProfile_id is required' });
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

        // 2. Kiểm tra Prescription và health profile ID
        if (prescriptionId) {
            const prescription = await Prescription.findById(prescriptionId).select('totalPrice healthProfile_id').lean();
            if (!prescription)
                return res.status(400).json({ message: `Prescription not found: ${prescriptionId}` });

            if (String(prescription.healthProfile_id) !== String(healthProfile_id))
                return res.status(400).json({ message: `healthProfile_id mismatch between invoice and prescription` });

            prescriptionTotalPrice = Number(prescription.totalPrice) || 0;
        }

        // 3. Kiểm tra LabOrder và health profile ID
        if (labOrderId) {
            const labOrder = await LabOrder.findById(labOrderId).select('totalPrice healthProfile_id').lean();
            if (!labOrder)
                return res.status(400).json({ message: `LabOrder not found: ${labOrderId}` });

            if (String(labOrder.healthProfile_id) !== String(healthProfile_id))
                return res.status(400).json({ message: `healthProfile_id mismatch between invoice and labOrder` });

            labOrderTotalPrice = Number(labOrder.totalPrice) || 0;
        }

        // 4. Tạo Invoice

        const totalPrice = prescriptionTotalPrice + labOrderTotalPrice;

        const invoice = new Invoice({
            totalPrice,
            status,
            healthProfile_id,
            created_at: new Date(created_at),
            prescriptionId: prescriptionId || null,
            labOrderId: labOrderId || null,
        });
        await invoice.save();

        // 5. Populate và trả về kết quả
        const result = await Invoice.findById(invoice._id)
            .populate({
                path: 'prescriptionId',
                populate: {
                    path: 'items',
                    populate: { path: 'medicineId', model: 'Medicine', select: 'name description price manufacturer' }
                }
            })
            .populate({
                path: 'labOrderId',
                populate: {
                    path: 'items',
                    populate: { path: 'serviceId', model: 'Service', select: 'name description price' }
                }
            })
            .lean();

        res.status(201).json(result);
    } catch (error) {
        // Xử lý lỗi Mongoose, v.v.
        res.status(400).json({ message: error.message });
    }
};

// GET /api/invoices/:id
exports.getById = async (req, res) => {
    try {
        const invoiceId = req.params.id;
        if (!invoiceId || !mongoose.isValidObjectId(invoiceId)) {
            return res.status(400).json({ message: 'Valid Invoice ID is required' });
        }

        const invoice = await Invoice.findById(invoiceId)
            .populate({
                path: 'prescriptionId',
                select: 'totalPrice items',
                populate: {
                    path: 'items',
                    select: 'quantity medicineId',
                    populate: { path: 'medicineId', model: 'Medicine', select: 'name price' }
                }
            })
            .populate({
                path: 'labOrderId',
                select: 'totalPrice items',
                populate: {
                    path: 'items',
                    select: 'quantity serviceId',
                    populate: { path: 'serviceId', model: 'Service', select: 'name price' }
                }
            })
            .populate({ path: 'healthProfile_id', model: 'HealthProfile', select: 'ownerId ownerModel' })
            .lean();

        if (!invoice) {
            return res.status(404).json({ message: `Invoice not found with ID: ${invoiceId}` });
        }

        // Resolve owner_detail like list
        let owner_detail = null;
        const hp = invoice.healthProfile_id;
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
            _id: invoice._id,
            created_at: invoice.created_at,
            totalPrice: Number(invoice.totalPrice) || 0,
            status: invoice.status,
            healthProfile_id: hp?._id || null,
            owner_detail,
            prescription: invoice.prescriptionId ? {
                _id: invoice.prescriptionId._id,
                totalPrice: Number(invoice.prescriptionId.totalPrice) || 0,
                items: Array.isArray(invoice.prescriptionId.items) ? invoice.prescriptionId.items.map(item => ({
                    _id: item._id,
                    medicineId: item.medicineId ? item.medicineId._id : null,
                    quantity: item.quantity,
                    medicine: item.medicineId,
                })) : []
            } : null,
            labOrder: invoice.labOrderId ? {
                _id: invoice.labOrderId._id,
                totalPrice: Number(invoice.labOrderId.totalPrice) || 0,
                items: Array.isArray(invoice.labOrderId.items) ? invoice.labOrderId.items.map(item => ({
                    _id: item._id,
                    quantity: item.quantity,
                    serviceId: item.serviceId ? item.serviceId._id : null,
                    service: item.serviceId,
                })) : []
            } : null,
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching invoice by ID:', error);
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
            prescriptionId: updatedInvoice.prescriptionId || null,
            labOrderId: updatedInvoice.labOrderId || null,
            healthProfile_id: updatedInvoice.healthProfile_id || null,
        };

        res.json(response);

    } catch (error) {
        console.error("Error updating invoice status:", error);
        res.status(500).json({ message: error.message });
    }
};