const express = require('express');
const mongoose = require('mongoose');
const Prescription = require('../models/prescription');
const Medicine = require('../models/medicine');
const { getPagingParams, buildPipelineStages, buildMeta, buildSearchFilter } = require('../helpers/query');
const HealthProfile = require('../models/healthProfile');
const Patient = require('../models/patient');
const FamilyMember = require('../models/familyMember');

// GET /api/prescriptions
exports.list = async (req, res) => {
    try {
        const { query } = req;
        const paging = getPagingParams(query, { sortBy: '_id', defaultLimit: 20, maxLimit: 200 });

        // Build basic filter conditions
        const conditions = {
            ...(query.id && mongoose.isValidObjectId(query.id) && { _id: new mongoose.Types.ObjectId(query.id) }),
            ...(query.healthProfile_id && mongoose.isValidObjectId(query.healthProfile_id) && { healthProfile_id: new mongoose.Types.ObjectId(query.healthProfile_id) }),
            ...(query.dateFrom || query.dateTo ? {
                createAt: {
                    ...(query.dateFrom && { $gte: new Date(query.dateFrom) }),
                    ...(query.dateTo && { $lte: new Date(query.dateTo) })
                }
            } : {})
        };

        const searchFields = [/* ... */]; // Keep as is
        const search = buildSearchFilter(query, searchFields);

        // Handle text search
        if (search.$text) {
            const regex = new RegExp(search.$text, 'i');

            // Find matching medicines by name or manufacturer
            const matchingMedicineIds = await Medicine.find({
                $or: [
                    { name: regex },
                    { manufacturer: regex }
                ]
            }).select('_id').lean();

            const medicineIds = matchingMedicineIds.map(m => m._id);

            // Add conditions to filter prescriptions by items or medicine details
            conditions.$or = [
                { 'items.dosage': regex },
                { 'items.frequency': regex },
                { 'items.duration': regex },
                { 'items.instruction': regex },
                { 'items.medicineId': { $in: medicineIds } }
            ];
        }

        // Main query with populate
        let dataQuery = Prescription.find(conditions)
            .populate({
                path: 'items.medicineId',
                model: 'Medicine',
                select: 'name price manufacturer unit expiryDate'
            })
            .populate({
                path: 'healthProfile_id',
                select: 'ownerId ownerModel'
            })
            .sort(paging.sort)
            .skip((paging.page - 1) * paging.limit)
            .limit(paging.limit)
            .lean();

        const [data, total] = await Promise.all([
            dataQuery.exec(),
            Prescription.countDocuments(conditions)
        ]);

        // resolve owner detail
        for (let prescription of data) {
            if (prescription.healthProfile_id?.ownerModel === "Patient") {
                const p = await Patient.findById(prescription.healthProfile_id.ownerId).lean();
                prescription.owner_detail = p ? {
                    name: p.name,
                    gender: p.gender,
                    dob: p.dob,
                    phone: p.phone
                } : null;
            } else if (prescription.healthProfile_id?.ownerModel === "FamilyMember") {
                const fm = await FamilyMember.findById(prescription.healthProfile_id.ownerId).lean();
                prescription.owner_detail = fm ? {
                    name: fm.name,
                    gender: fm.gender,
                    dob: fm.dob,
                    phone: fm.phone
                } : null;
            }
        }

        // Format the response
        const formatted = data.map(prescription => ({
            id: prescription._id,
            createAt: prescription.createAt,
            healthProfile_id: prescription.healthProfile_id?._id || null,
            owner_detail: prescription.owner_detail || null,
            totalPrice: prescription.totalPrice || 0,
            items: (prescription.items || []).map(item => ({
                quantity: item.quantity,
                dosage: item.dosage,
                frequency: item.frequency,
                duration: item.duration,
                instruction: item.instruction,
                medicineId: item.medicineId ? item.medicineId._id : null,
                medicine: item.medicineId ? {
                    _id: item.medicineId._id,
                    name: item.medicineId.name,
                    price: item.medicineId.price,
                    manufacturer: item.medicineId.manufacturer,
                    unit: item.medicineId.unit,
                    expiryDate: item.medicineId.expiryDate,
                } : null
            }))
        }));

        res.json({ data: formatted, meta: buildMeta(total, paging.page, paging.limit) });
    } catch (error) {
        console.error('Error in prescription list:', error);
        res.status(500).json({ message: error.message });
    }
};

// GET /api/prescriptions/:id
exports.getById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid prescription ID' });
        }

        const prescription = await Prescription.findById(id)
            .populate({
                path: 'items.medicineId',
                model: 'Medicine',
                select: 'name price manufacturer unit expiryDate'
            })
            .populate({
                path: 'healthProfile_id',
                select: 'ownerId ownerModel'
            })
            .lean();

        if (!prescription) {
            return res.status(404).json({ message: 'Prescription not found' });
        }

        // Resolve owner_detail like list
        let owner_detail = null;
        const hp = prescription.healthProfile_id;
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
            id: prescription._id,
            createAt: prescription.createAt,
            healthProfile_id: hp?._id || null,
            owner_detail,
            totalPrice: prescription.totalPrice || 0,
            items: (prescription.items || []).map(item => ({
                quantity: item.quantity,
                dosage: item.dosage,
                frequency: item.frequency,
                duration: item.duration,
                instruction: item.instruction,
                medicineId: item.medicineId ? item.medicineId._id : null,
                medicine: item.medicineId ? {
                    _id: item.medicineId._id,
                    name: item.medicineId.name,
                    price: item.medicineId.price,
                    manufacturer: item.medicineId.manufacturer,
                    unit: item.medicineId.unit,
                    expiryDate: item.medicineId.expiryDate,
                } : null
            }))
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching prescription by ID:', error);
        res.status(500).json({ message: error.message });
    }
};

// POST /api/prescriptions
exports.create = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { createAt = new Date().toISOString(), healthProfile_id, items } = req.body;

        // Validation: Check if items array is valid
        if (!Array.isArray(items) || items.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Items (medicines) are required' });
        }

        // validate healthProfile_id
        if (!mongoose.isValidObjectId(healthProfile_id)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Invalid healthProfile_id: ${healthProfile_id}` });
        }

        // check healthProfile tồn tại
        const hp = await HealthProfile.findById(healthProfile_id).session(session);
        if (!hp) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Health Profile not found' });
        }

        // Validate each item
        const requiredFields = ['medicineId', 'quantity', 'dosage', 'frequency', 'duration', 'instruction'];
        for (const item of items) {
            if (!item || requiredFields.some((k) => item[k] == null)) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: 'Each item must include medicineId, quantity, dosage, frequency, duration, and instruction' });
            }
            if (!mongoose.isValidObjectId(item.medicineId)) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: `Invalid medicineId: ${item.medicineId}` });
            }
            if (item.quantity <= 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: `Quantity for medicine ${item.medicineId} must be greater than 0` });
            }
        }

        // Verify medicines and check stock quantity
        const medicineIds = items.map((item) => new mongoose.Types.ObjectId(item.medicineId));
        const medicines = await Medicine.find({ _id: { $in: medicineIds } }).session(session);
        if (medicines.length !== new Set(medicineIds.map((id) => id.toString())).size) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'One or more medicines not found' });
        }

        // Check stock availability
        const medicineMap = new Map(medicines.map((m) => [m._id.toString(), m]));
        for (const item of items) {
            const medicine = medicineMap.get(item.medicineId.toString());
            if (!medicine || medicine.quantity < Number(item.quantity)) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    message: `Insufficient stock for medicine ${medicine?.name || item.medicineId}. Available: ${medicine?.quantity || 0}, Requested: ${item.quantity}`
                });
            }
        }

        // Calculate totalPrice with rounding to avoid floating-point issues
        const medicinePriceMap = new Map(medicines.map((m) => [m._id.toString(), m.price || 0]));
        const totalPrice = Number.parseFloat(
            items.reduce((sum, item) => {
                const price = medicinePriceMap.get(item.medicineId.toString()) || 0;
                return sum + price * Number(item.quantity);
            }, 0).toFixed(2)
        );

        // Prepare items for embedding
        const formattedItems = items.map((item) => ({
            medicineId: new mongoose.Types.ObjectId(item.medicineId),
            quantity: Number(item.quantity),
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            instruction: item.instruction
        }));

        // Create and save the Prescription with embedded items
        const prescription = new Prescription({
            createAt,
            healthProfile_id,
            totalPrice,
            items: formattedItems
        });
        await prescription.save({ session });

        // Deduct stock quantities
        for (const item of items) {
            const medicineId = item.medicineId.toString();
            const medicine = medicineMap.get(medicineId);
            await Medicine.updateOne(
                { _id: medicine._id, quantity: { $gte: Number(item.quantity) } },
                { $inc: { quantity: -Number(item.quantity) } },
                { session }
            );
        }

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        // Populate the embedded items' medicineId
        const result = await Prescription.findById(prescription._id)
            .populate('items.medicineId', 'name price manufacturer unit expiryDate')
            .lean();

        // Format the response
        const formattedResult = {
            id: result._id,
            createAt: result.createAt,
            healthProfile_id: result.healthProfile_id,
            totalPrice: result.totalPrice,
            items: (result.items || []).map((item) => ({
                quantity: item.quantity,
                dosage: item.dosage,
                frequency: item.frequency,
                duration: item.duration,
                instruction: item.instruction,
                medicineId: item.medicineId ? item.medicineId._id : null,
                medicine: item.medicineId ? {
                    _id: item.medicineId._id,
                    name: item.medicineId.name,
                    price: item.medicineId.price,
                    manufacturer: item.medicineId.manufacturer,
                    unit: item.medicineId.unit,
                    expiryDate: item.medicineId.expiryDate,
                } : null
            }))
        };

        res.status(201).json(formattedResult);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error in prescription create:', error);
        res.status(400).json({ message: error.message });
    }
};