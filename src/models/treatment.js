const mongoose = require("mongoose");

const treatmentSchema = new mongoose.Schema({
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
    appointment: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Appointment'
    },
    treatmentDate: { type: Date, required: true },
    treatmentType: { 
        type: String, 
        required: true 
    },
    diagnosis: { type: String, required: true },
    treatment: { type: String, required: true },
    medications: [{
        name: { type: String, required: true },
        dosage: { type: String, required: true },
        frequency: { type: String, required: true },
        duration: { type: String, required: true },
        instructions: { type: String }
    }],
    totalCost: { type: Number, required: true },
    paymentStatus: { 
        type: String, 
        enum: ["Pending", "Partial", "Paid"],
        default: "Pending" 
    },
    notes: { type: String },
    treatmentStatus: { 
        type: String, 
        enum: ["In-Progress", "Completed", "Requires Follow-up"],
        default: "Completed" 
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Treatment", treatmentSchema, "treatments");