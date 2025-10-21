const Appointment = require('../models/appointment');
const Patient = require('../models/patient');
const Doctor = require('../models/doctor');

// [POST] /appointments
module.exports.create = async (req, res) => {
    const { patient_id, doctor_id, appointmentDate, reason } = req.body;

    try{
        const patient = await Patient.findById(patient_id);
        if(!patient || patient.deleted || patient.status === 'inactive') {
            return res.status(400).json({ message: "Bệnh nhân không hợp lệ!" });
        }
    } catch(err) {
        return res.status(400).json({ message: "Bệnh nhân không hợp lệ!" });
    }