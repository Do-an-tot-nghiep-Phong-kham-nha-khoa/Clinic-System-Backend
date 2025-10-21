const mongoose = require('mongoose');
const specialty = require('./specialty');

const appointmentSchema = new mongoose.Schema({
    booker_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    profile: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true, 
        refPath: "profileModel" 
    },
    profileModel: { 
        type: String, 
        required: true, 
        enum: ['Patient', 'FamilyMember'] 
    },
    doctor_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true
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
        enum: ['pending', 'completed', 'canceled'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Appointment', appointmentSchema);