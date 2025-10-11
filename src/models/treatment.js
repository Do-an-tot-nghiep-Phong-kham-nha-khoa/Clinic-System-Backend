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
    teeth: [{ 
        toothNumber: { type: String }, // "11", "12", etc. (ISO notation)
        condition: { type: String },
        treatmentApplied: { type: String }
    }],
    diagnosis: { type: String, required: true },
    treatment: { type: String, required: true },
    medications: [{
        name: { type: String, required: true },
        dosage: { type: String, required: true },
        frequency: { type: String, required: true },
        duration: { type: String, required: true },
        instructions: { type: String }
    }],
    materials: [{
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        cost: { type: Number }
    }],
    procedures: [{
        name: { type: String, required: true },
        description: { type: String },
        cost: { type: Number }
    }],
    totalCost: { type: Number, required: true },
    paymentStatus: { 
        type: String, 
        enum: ["Pending", "Partial", "Paid"],
        default: "Pending" 
    },
    notes: { type: String },
    beforeImages: [{ type: String }], // URLs to images
    afterImages: [{ type: String }], // URLs to images
    xrayImages: [{ type: String }], // URLs to X-ray images
    followUpRequired: { type: Boolean, default: false },
    followUpDate: { type: Date },
    followUpNotes: { type: String },
    complications: { type: String },
    patientReaction: { type: String },
    treatmentStatus: { 
        type: String, 
        enum: ["In-Progress", "Completed", "Requires Follow-up"],
        default: "Completed" 
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Treatment", treatmentSchema, "treatments");