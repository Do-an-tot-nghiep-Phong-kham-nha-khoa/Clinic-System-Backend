const Appointment = require('../models/appointment');
const Invoice = require('../models/invoice');
const Prescription = require('../models/prescription');
const LabOrder = require('../models/labOrder');

exports.getAppointmentsLast7Days = async (req, res) => {
    try {
        const last7Days = await Appointment.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json(last7Days);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
}

exports.getRevenueLast7Days = async (req, res) => {
    try {
        const data = await Invoice.aggregate([
            {
                $match: {
                    status: "Paid",
                    created_at: {
                        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$created_at" }
                    },
                    totalRevenue: { $sum: "$totalPrice" },
                    invoiceCount: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json(data);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
}

exports.getAppointmentStatusStats = async (req, res) => {
    try {
        const data = await Appointment.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json(data);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
}

exports.getTotalRevenue = async (req, res) => {
    try {
        const result = await Invoice.aggregate([
            { $match: { status: "Paid" } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$totalPrice" }
                }
            }
        ]);

        res.json({
            totalRevenue: result[0]?.totalRevenue || 0
        });

    } catch (e) {
        res.status(500).json({ message: e.message });
    }
}

exports.getTotalAppointments = async (req, res) => {
    try {
        const result = await Appointment.countDocuments();
        res.json({ totalAppointments: result });
    }
    catch (e) {
        res.status(500).json({ message: e.message });
    }
}

exports.getTopMedicines = async (req, res) => {
    try {
        const top = await Prescription.aggregate([
            { $unwind: "$items" },

            {
                $group: {
                    _id: "$items.medicineId",
                    totalQuantity: { $sum: "$items.quantity" },
                    usedCount: { $sum: 1 }
                }
            },

            { $sort: { totalQuantity: -1 } },
            { $limit: 10 },

            {
                $lookup: {
                    from: "medicines",
                    localField: "_id",
                    foreignField: "_id",
                    as: "medicine"
                }
            },

            { $unwind: "$medicine" }
        ]);

        res.json(top);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
}

exports.getTopServices = async (req, res) => {
    try {
        const top = await LabOrder.aggregate([
            { $unwind: "$items" },

            {
                $group: {
                    _id: "$items.serviceId",
                    totalQuantity: { $sum: "$items.quantity" },
                    usedCount: { $sum: 1 }
                }
            },

            { $sort: { totalQuantity: -1 } },
            { $limit: 10 },

            {
                $lookup: {
                    from: "services",
                    localField: "_id",
                    foreignField: "_id",
                    as: "service"
                }
            },

            { $unwind: "$service" }
        ]);

        res.json(top);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
}

