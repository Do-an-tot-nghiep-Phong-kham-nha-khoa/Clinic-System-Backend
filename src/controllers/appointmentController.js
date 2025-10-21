const Appointment = require("../models/appointment");
const Doctor = require("../models/doctor");
const Patient = require("../models/patient");

class AppointmentController {
  // Tạo cuộc hẹn mới
  async createAppointment(req, res) {
    try {
      const { 
        patient, 
        doctor, 
        nurse, 
        appointmentDate, 
        appointmentTime, 
        treatmentType, 
        notes, 
        symptoms, 
        estimatedCost,
        room
      } = req.body;

      // Validate required fields
      if (!patient || !doctor || !appointmentDate || !appointmentTime || !treatmentType) {
        return res.status(400).json({ 
          message: "Thiếu thông tin bắt buộc: patient, doctor, appointmentDate, appointmentTime, treatmentType" 
        });
      }

      // Check if doctor exists
      const doctorExists = await Doctor.findById(doctor);
      if (!doctorExists) {
        return res.status(404).json({ message: "Không tìm thấy bác sĩ" });
      }

      // Check if patient exists
      const patientExists = await Patient.findById(patient);
      if (!patientExists) {
        return res.status(404).json({ message: "Không tìm thấy bệnh nhân" });
      }

      // Check for appointment conflicts (same doctor, date, and time)
      const conflictingAppointment = await Appointment.findOne({
        doctor,
        appointmentDate: new Date(appointmentDate),
        appointmentTime,
        status: { $nin: ['Cancelled', 'Completed'] }
      });

      if (conflictingAppointment) {
        return res.status(409).json({ 
          message: "Bác sĩ đã có cuộc hẹn vào thời gian này" 
        });
      }

      const appointment = new Appointment({
        patient,
        doctor,
        nurse,
        appointmentDate: new Date(appointmentDate),
        appointmentTime,
        treatmentType,
        notes,
        symptoms,
        estimatedCost,
        room
      });

      const savedAppointment = await appointment.save();
      
      // Populate the saved appointment with doctor and patient details
      const populatedAppointment = await Appointment.findById(savedAppointment._id)
        .populate('doctor', 'name email expertise')
        .populate('patient', 'name email phone')
        .populate('nurse', 'name department');

      res.status(201).json({
        message: "Tạo cuộc hẹn thành công",
        data: populatedAppointment
      });
    } catch (err) {
      console.error("Error creating appointment:", err);
      res.status(400).json({ 
        message: "Lỗi khi tạo cuộc hẹn",
        error: err.message 
      });
    }
  }

  // Lấy tất cả cuộc hẹn
  async getAllAppointments(req, res) {
    try {
      const { status, doctor, date } = req.query;
      let filter = {};

      if (status) filter.status = status;
      if (doctor) filter.doctor = doctor;
      if (date) filter.appointmentDate = new Date(date);

      const appointments = await Appointment.find(filter)
        .populate('doctor', 'name email expertise')
        .populate('patient', 'name email phone')
        .populate('nurse', 'name department')
        .sort({ appointmentDate: 1, appointmentTime: 1 });
      
      res.status(200).json({
        message: "Lấy danh sách cuộc hẹn thành công",
        count: appointments.length,
        data: appointments
      });
    } catch (err) {
      console.error("Error fetching appointments:", err);
      res.status(500).json({ 
        message: "Lỗi khi lấy danh sách cuộc hẹn",
        error: err.message 
      });
    }
  }

  // Lấy cuộc hẹn theo ID
  async getAppointmentById(req, res) {
    try {
      const { id } = req.params;
      const appointment = await Appointment.findById(id)
        .populate('doctor', 'name email expertise phone')
        .populate('patient', 'name email phone address')
        .populate('nurse', 'name department phone');

      if (!appointment) {
        return res.status(404).json({ 
          message: "Không tìm thấy cuộc hẹn" 
        });
      }

      res.status(200).json({
        message: "Lấy thông tin cuộc hẹn thành công",
        data: appointment
      });
    } catch (err) {
      console.error("Error fetching appointment by ID:", err);
      res.status(500).json({ 
        message: "Lỗi khi lấy thông tin cuộc hẹn",
        error: err.message 
      });
    }
  }

  // Cập nhật cuộc hẹn
  async updateAppointment(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Remove fields that shouldn't be updated directly
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      const updatedAppointment = await Appointment.findByIdAndUpdate(
        id, 
        updateData, 
        { new: true, runValidators: true }
      ).populate('doctor', 'name email expertise')
       .populate('patient', 'name email phone')
       .populate('nurse', 'name department');

      if (!updatedAppointment) {
        return res.status(404).json({ 
          message: "Không tìm thấy cuộc hẹn để cập nhật" 
        });
      }

      res.status(200).json({
        message: "Cập nhật cuộc hẹn thành công",
        data: updatedAppointment
      });
    } catch (err) {
      console.error("Error updating appointment:", err);
      res.status(400).json({ 
        message: "Lỗi khi cập nhật cuộc hẹn",
        error: err.message 
      });
    }
  }

  // Hủy cuộc hẹn
  async cancelAppointment(req, res) {
    try {
      const { id } = req.params;
      const { cancelReason } = req.body;

      const cancelledAppointment = await Appointment.findByIdAndUpdate(
        id,
        { 
          status: "Cancelled", 
          cancelReason: cancelReason || "No reason provided" 
        },
        { new: true }
      ).populate('doctor', 'name email')
       .populate('patient', 'name email phone');

      if (!cancelledAppointment) {
        return res.status(404).json({ 
          message: "Không tìm thấy cuộc hẹn để hủy" 
        });
      }

      res.status(200).json({
        message: "Hủy cuộc hẹn thành công",
        data: cancelledAppointment
      });
    } catch (err) {
      console.error("Error cancelling appointment:", err);
      res.status(500).json({ 
        message: "Lỗi khi hủy cuộc hẹn",
        error: err.message 
      });
    }
  }

  // Lấy cuộc hẹn theo bác sĩ
  async getAppointmentsByDoctor(req, res) {
    try {
      const { doctorId } = req.params;
      const { date, status } = req.query;

      let filter = { doctor: doctorId };
      if (date) filter.appointmentDate = new Date(date);
      if (status) filter.status = status;

      const appointments = await Appointment.find(filter)
        .populate('patient', 'name email phone')
        .populate('nurse', 'name department')
        .sort({ appointmentDate: 1, appointmentTime: 1 });

      res.status(200).json({
        message: "Lấy danh sách cuộc hẹn theo bác sĩ thành công",
        doctorId,
        count: appointments.length,
        data: appointments
      });
    } catch (err) {
      console.error("Error fetching appointments by doctor:", err);
      res.status(500).json({ 
        message: "Lỗi khi lấy cuộc hẹn theo bác sĩ",
        error: err.message 
      });
    }
  }

  // Lấy cuộc hẹn theo bệnh nhân
  async getAppointmentsByPatient(req, res) {
    try {
      const { patientId } = req.params;
      
      const appointments = await Appointment.find({ patient: patientId })
        .populate('doctor', 'name email expertise')
        .populate('nurse', 'name department')
        .sort({ appointmentDate: -1 });

      res.status(200).json({
        message: "Lấy danh sách cuộc hẹn theo bệnh nhân thành công",
        patientId,
        count: appointments.length,
        data: appointments
      });
    } catch (err) {
      console.error("Error fetching appointments by patient:", err);
      res.status(500).json({ 
        message: "Lỗi khi lấy cuộc hẹn theo bệnh nhân",
        error: err.message 
      });
    }
  }
}

module.exports = new AppointmentController();