const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema({
    // Số hóa đơn
    invoiceNumber: {
        type: String,
        required: true,
        unique: true
    },

    // Treatment tương ứng
    treatmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Treatment",
        required: true
    },

    healthProfile_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "HealthProfile",
        required: true
    },

    issued_at: {
        type: Date,
        default: Date.now
    },

    due_date: {
        type: Date,
        required: false
    },

    totalPrice: {
        type: Number,
        required: true
    },

    status: {
        type: String,
        enum: ["Paid", "Pending", "Cancelled", "Refunded"],
        default: "Pending"
    },
    // Payment records (một invoice có thể nhiều payment)
    payments: [
        {
            method: String,          // cash, card, momo, vnpay, insurance
            amount: Number,
            status: String,          // success, failed, refunded
            provider: String,        // momo, vnpay, visa
            providerPaymentId: String,  // ID từ payment provider (txnRef)
            providerTransactionNo: String, // Transaction number từ provider sau khi thanh toán thành công
            meta: mongoose.Schema.Types.Mixed,
            paid_at: { type: Date, default: Date.now }
        }
    ]
});

module.exports = mongoose.model("Invoice", invoiceSchema);
