const express = require('express');
const mongoose = require('mongoose');
const Prescription = require('../models/prescription');
const MedicineInPrescription = require('../models/medicineInPrescription');
const Medicine = require('../models/medicine');
const { getPagingParams, buildPipelineStages, buildMeta, buildSearchFilter } = require('../helpers/query');

// GET /api/prescriptions
exports.list = async (req, res) => {
    try {
        const { query } = req;
        const paging = getPagingParams(query, { sortBy: '_id', defaultLimit: 20, maxLimit: 200 });

        // Bộ lọc cơ bản
        const conditions = {
            ...(query.id && mongoose.isValidObjectId(query.id) && { _id: new mongoose.Types.ObjectId(query.id) }),
            ...(query.patientId && mongoose.isValidObjectId(query.patientId) && { patientId: new mongoose.Types.ObjectId(query.patientId) }),
            ...(query.dateFrom || query.dateTo ? {
                createAt: {
                    ...(query.dateFrom && { $gte: new Date(query.dateFrom) }),
                    ...(query.dateTo && { $lte: new Date(query.dateTo) })
                }
            } : {})
        };

        const searchFields = [ /* ... */]; // Giữ nguyên
        const search = buildSearchFilter(query, searchFields);

        if (search.$text) {
            const regex = new RegExp(search.$text, 'i');

            // 1. Tìm các Medicine ID khớp với tên hoặc nhà sản xuất
            const matchingMedicineIds = await Medicine.find({
                $or: [
                    { name: regex },
                    { manufacturer: regex }
                ]
            }).select('_id'); // Chỉ lấy _id

            const medicineIds = matchingMedicineIds.map(m => m._id);

            // 2. Tìm các MedicineInPrescription khớp với:
            const matchingItems = await MedicineInPrescription.find({
                $or: [
                    { dosage: regex },
                    { frequency: regex },
                    { duration: regex },
                    { instruction: regex },
                    { medicineId: { $in: medicineIds } }
                ]
            }).select('prescriptionId'); // Chỉ lấy prescriptionId

            // Lấy danh sách ID đơn thuốc duy nhất
            const prescriptionIds = [...new Set(matchingItems.map(item => item.prescriptionId))];

            conditions._id = { ...conditions._id, $in: prescriptionIds };
        }
        // Truy vấn chính (giờ đã bao gồm filter search nếu có)
        let dataQuery = Prescription.find(conditions)
            .populate({
                path: 'items',
                model: 'MedicineInPrescription',
                populate: {
                    path: 'medicineId',
                    model: 'Medicine',
                    select: 'name price quantity dosageForm manufacturer unit expiryDate __v'
                }
            })
            .sort(paging.sortBy)
            .skip((paging.page - 1) * paging.limit)
            .limit(paging.limit)
            .lean();

        const [data, total] = await Promise.all([
            dataQuery.exec(),
            Prescription.countDocuments(conditions)
        ]);

        // Chuyển đổi dữ liệu để trả về đúng định dạng mong muốn (Giữ nguyên)
        const formatted = data.map(prescription => ({
            id: prescription._id,
            createAt: prescription.createAt,
            patientId: prescription.patientId || null,
            totalPrice: prescription.totalPrice || 0,
            items: (prescription.items || []).map(item => ({
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
                    id: item.medicineId.id,
                    name: item.medicineId.name,
                    price: item.medicineId.price,
                    quantity: item.medicineId.quantity,
                    dosageForm: item.medicineId.dosageForm,
                    manufacturer: item.medicineId.manufacturer,
                    unit: item.medicineId.unit,
                    expiryDate: item.medicineId.expiryDate,
                    __v: item.medicineId.__v || 0
                } : null
            }))
        }));

        res.json({ data: formatted, meta: buildMeta(total, paging.page, paging.limit) });
    } catch (error) {
        console.error('Error in prescription list:', error);
        res.status(500).json({ message: error.message });
    }
};

// POST /api/prescriptions
exports.create = async (req, res) => {
    try {
        const { createAt = new Date().toISOString(), patientId, items } = req.body;

        // --- (Toàn bộ phần Validation của bạn giữ nguyên) ---
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Items (medicines) are required' });
        }
        // ... (các validation khác) ...
        if (!mongoose.isValidObjectId(patientId)) {
            return res.status(400).json({ message: `Invalid patientId: ${patientId}` });
        }
        // ... (phần check medicineId, v.v...)

        // --- (Phần tính toán totalPrice của bạn giữ nguyên) ---
        const medicineIds = items.map((item) => new mongoose.Types.ObjectId(item.medicineId));
        const medicines = await Medicine.find({ _id: { $in: medicineIds } }).lean();
        if (medicines.length !== new Set(medicineIds.map((id) => id.toString())).size) {
            return res.status(400).json({ message: 'One or more medicines not found' });
        }
        const medicinePriceMap = new Map(medicines.map((m) => [m._id.toString(), m.price || 0]));
        const totalPrice = items.reduce((sum, item) => {
            const price = medicinePriceMap.get(item.medicineId.toString()) || 0;
            return sum + price * Number(item.quantity);
        }, 0);

        // --- BẮT ĐẦU PHẦN SỬA LOGIC LƯU ---

        // 1. Tạo prescription "header" (chưa có items)
        const prescription = new Prescription({
            createAt,
            patientId,
            totalPrice,
            items: [] // Khởi tạo mảng rỗng
        });
        await prescription.save(); // Lưu lần 1 để lấy _id

        // 2. Chuẩn bị các item-con, gán prescriptionId cho chúng
        const mipDocs = items.map((item) => ({
            prescriptionId: prescription._id, // Gán ID của prescription cha
            medicineId: new mongoose.Types.ObjectId(item.medicineId),
            quantity: Number(item.quantity),
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            instruction: item.instruction,
        }));

        // 3. Lưu các item-con và LẤY KẾT QUẢ trả về
        const createdItems = await MedicineInPrescription.insertMany(mipDocs);

        // 4. Lấy ID của các item-con vừa tạo...
        const itemIds = createdItems.map(item => item._id);

        // 5. ...và cập nhật lại prescription cha để lưu mảng ID tham chiếu này
        prescription.items = itemIds;
        await prescription.save(); // Lưu lần 2

        // --- KẾT THÚC PHẦN SỬA LOGIC LƯU ---

        // 6. Trả về kết quả đã populate (thay vì dùng Aggregation phức tạp)
        // (Cách này giống với hàm `list` của bạn, hiệu quả hơn)
        const result = await Prescription.findById(prescription._id)
            .populate({
                path: 'items', // Populate mảng 'items' (giờ đã chứa các ID)
                model: 'MedicineInPrescription', // (Thay bằng tên Model của bạn)
                populate: {
                    path: 'medicineId',
                    model: 'Medicine', // (Thay bằng tên Model của bạn)
                    select: 'name price quantity dosageForm manufacturer unit expiryDate __v'
                }
            })
            .lean(); // Dùng .lean() để có object thuần túy

        // 7. Format lại kết quả trả về (vì .lean() không có virtual 'id')
        // (Đây là logic format từ hàm LIST của bạn)
        const formattedResult = {
            id: result._id,
            createAt: result.createAt,
            patientId: result.patientId,
            totalPrice: result.totalPrice,
            items: (result.items || []).map(item => ({
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
                    id: item.medicineId.id, // (Nếu bạn có virtual 'id')
                    name: item.medicineId.name,
                    price: item.medicineId.price,
                    quantity: item.medicineId.quantity,
                    dosageForm: item.medicineId.dosageForm,
                    manufacturer: item.medicineId.manufacturer,
                    unit: item.medicineId.unit,
                    expiryDate: item.medicineId.expiryDate,
                    __v: item.medicineId.__v || 0
                } : null
            }))
        };

        res.status(201).json(formattedResult);

    } catch (error) {
        console.error('Error in prescription create:', error); // Thêm log lỗi
        res.status(400).json({ message: error.message });
    }
};