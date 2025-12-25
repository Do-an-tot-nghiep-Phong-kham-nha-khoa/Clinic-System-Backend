const Appointment = require('../models/appointment');
const Invoice = require('../models/invoice');
const Prescription = require('../models/prescription');
const LabOrder = require('../models/labOrder');

exports.getDashboardStats = async (req, res) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [
            appointmentsLast7Days,
            appointmentStatusStats,
            revenueLast7Days,
            totalRevenueResult,
            totalAppointments,
            topMedicines,
            topServices
        ] = await Promise.all([

            Appointment.aggregate([
                { $match: { createdAt: { $gte: sevenDaysAgo } } },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: "%Y-%m-%d",
                                date: "$appointmentDate"
                            }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            Appointment.aggregate([
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 }
                    }
                }
            ]),

            Invoice.aggregate([
                {
                    $match: {
                        status: "Paid",
                        created_at: { $gte: sevenDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: "%Y-%m-%d",
                                date: "$created_at"
                            }
                        },
                        totalRevenue: { $sum: "$totalPrice" }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            Invoice.aggregate([
                { $match: { status: "Paid" } },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: "$totalPrice" }
                    }
                }
            ]),

            Appointment.countDocuments(),

            Prescription.aggregate([
                { $unwind: "$items" },
                {
                    $group: {
                        _id: "$items.medicineId",
                        totalQuantity: { $sum: "$items.quantity" }
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
            ]),

            LabOrder.aggregate([
                { $unwind: "$items" },
                {
                    $group: {
                        _id: "$items.serviceId",
                        totalQuantity: { $sum: "$items.quantity" }
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
            ])
        ]);

        res.json({
            appointmentsLast7Days,
            appointmentStatusStats,
            revenueLast7Days,
            totalRevenue: totalRevenueResult[0]?.totalRevenue || 0,
            totalAppointments,
            topMedicines,
            topServices
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to load dashboard stats" });
    }
};
