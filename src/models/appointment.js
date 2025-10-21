const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
    patient: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Patient', 
        required: true 
    },
    doctor: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Doctor', 
        required: true 
    },
    nurse: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Nurse'
    },
    appointmentDate: { type: Date, required: true },
    appointmentTime: { type: String, required: true }, // "09:00", "14:30"
    duration: { type: Number, default: 30 }, // minutes
    treatmentType: { 
        type: String, 
        enum: ["Consultation", "Cleaning", "Filling", "Root Canal", "Extraction", "Surgery", "Checkup", "Emergency"],
        required: true 
    },
    status: { 
        type: String, 
        enum: ["Scheduled", "Confirmed", "In-Progress", "Completed", "Cancelled", "No-Show"],
        default: "Scheduled" 
    },
    notes: { type: String },
    symptoms: [{ type: String }],
    urgencyLevel: { 
        type: String, 
        enum: ["Low", "Medium", "High", "Emergency"],
        default: "Medium" 
    },
    estimatedCost: { type: Number },
    actualCost: { type: Number },
    paymentStatus: { 
        type: String, 
        enum: ["Pending", "Partial", "Paid", "Refunded"],
        default: "Pending" 
    },
    reminderSent: { type: Boolean, default: false },
    room: { type: String },
    cancelReason: { type: String }
}, {
    timestamps: true
});

// Index for efficient queries
appointmentSchema.index({ doctor: 1, appointmentDate: 1, appointmentTime: 1 });
appointmentSchema.index({ patient: 1, appointmentDate: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema, "appointments");