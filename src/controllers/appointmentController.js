const Appointment = require('../models/appointment');
const Patient = require('../models/patient');
const Doctor = require('../models/doctor');

// [POST] /appointments
module.exports.create = async (req, res) => {
    try{
        const {booker_id, profileId, profileModel, doctor_id, specialty_id, appointmentDate, timeSlot, reason} = req.body;
        
        // Check validate 
        if(!booker_id || !profileId || !profileModel || !doctor_id || !specialty_id || !appointmentDate || !timeSlot || !reason) {
            return  res.status(400).json({ message: 'Missing required fields' });
        }

        // Identify patient
        const patient = await Patient.findById(booker_id);
        if(!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        // Đặt lịch hẹn theo bác sĩ hoặc theo chuyên khoa
        let specialty = null;
        let doctor = null;
        let status = 'waiting_assigned';

        // Nếu có doctorId, đặt theo bác sĩ
        if(doctor_id) {
            doctor = await Doctor.findById(doctor_id);
            if(!doctor) {
                return res.status(404).json({ message: 'Doctor not found' });
            }
            // Lấy chuyên khoa từ bác sĩ
            specialty = doctor.specialtyId;

            // Kiểm tra trùng lịch
            const existedAppointment = await Appointment.findOne({
                doctor_id: doctor._id,
                appointmentDate,
                timeSlot,
                status: { $in: [ 'pending', 'confirmed'] }
            });
            if(existedAppointment) {
                return res.status(400).json({ message: 'Time slot already booked for this doctor' });
            }
        } else {
            // Nếu không có doctorId, đặt theo chuyên khoa
            specialty = await Specialty.findById(specialty_id);
            if(!specialty) {
                return res.status(404).json({ message: 'Specialty not found' });
            }
            status = "waiting_assigned";
        }

        // Tạo lịch hẹn mới
        const newAppointment = new Appointment({
            booker_id: booker_id,
            profile: profileId,
            profileModel,
            doctor_id: doctor ? doctor._id : null,
            specialty_id: specialty._id,
            appointmentDate,
            timeSlot,
            reason,
            status
        });
        await newAppointment.save();
        if(status === 'pending') {
            return res.status(201).json({ message: 'Appointment booked with doctor successfully', appointment: newAppointment });
        } else {
            return res.status(201).json({ message: 'Appointment booked with specialty successfully', appointment: newAppointment });
        }
    } catch (error) {
        console.error('Error creating appointment:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
