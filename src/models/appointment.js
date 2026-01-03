const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    booker_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    healthProfile_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HealthProfile',
        required: true
    },
    doctor_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
    },
    specialty_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Specialty',
        required: true
    },
    appointmentDate: {
        type: Date,
        required: true
    },
    timeSlot: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["waiting_assigned", "pending", "confirmed", "cancelled", "completed"],
        default: 'waiting_assigned'
    },
    // ===== SNAPSHOTS để tránh N+1 query =====
    patientSnapshot: {
        name: String,
        dob: Date,
        phone: String,
        gender: String,
        ownerModel: String  // "Patient" hoặc "FamilyMember"
    },
    doctorSnapshot: {
        name: String,
        phone: String,
        experience: Number,
        avatar: String
    },
    specialtySnapshot: {
        name: String,
        description: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Appointment', appointmentSchema);