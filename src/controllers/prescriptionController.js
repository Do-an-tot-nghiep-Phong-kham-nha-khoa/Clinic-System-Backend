const express = require('express');
const mongoose = require('mongoose');
const Prescription = require('../models/prescription');
const Medicine = require('../models/medicine');
const { getPagingParams, buildPipelineStages, buildMeta, buildSearchFilter } = require('../helpers/query');

// GET /api/prescriptions
exports.list = async (req, res) => {
    try {
        const { query } = req;
        const paging = getPagingParams(query, { sortBy: '_id', defaultLimit: 20, maxLimit: 200 });

        // Build basic filter conditions
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
                select: 'name price quantity dosageForm manufacturer unit expiryDate'
            })
            .sort(paging.sort)
            .skip((paging.page - 1) * paging.limit)
            .limit(paging.limit)
            .lean();

        const [data, total] = await Promise.all([
            dataQuery.exec(),
            Prescription.countDocuments(conditions)
        ]);

        // Format the response
        const formatted = data.map(prescription => ({
            id: prescription._id,
            createAt: prescription.createAt,
            patientId: prescription.patientId || null,
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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { createAt = new Date().toISOString(), patientId, items } = req.body;

        // Validation: Check if items array is valid
        if (!Array.isArray(items) || items.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Items (medicines) are required' });
        }

        // Validate patientId
        if (!mongoose.isValidObjectId(patientId)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Invalid patientId: ${patientId}` });
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
            patientId,
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
            .populate('items.medicineId', 'name price quantity dosageForm manufacturer unit expiryDate')
            .lean();

        // Format the response
        const formattedResult = {
            id: result._id,
            createAt: result.createAt,
            patientId: result.patientId,
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
        await session.abortTransaction();
        session.endSession();
        console.error('Error in prescription create:', error);
        res.status(400).json({ message: error.message });
    }
};