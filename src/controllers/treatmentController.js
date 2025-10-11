const Treatment = require("../models/treatment");
const Doctor = require("../models/doctor");
const Patient = require("../models/patient");
const Appointment = require("../models/appointment");

class TreatmentController {
  // Tạo hồ sơ điều trị mới
  async createTreatment(req, res) {
    try {
      const {
        patient,
        doctor,
        appointment,
        treatmentDate,
        treatmentType,
        teeth,
        diagnosis,
        treatment,
        medications,
        materials,
        procedures,
        totalCost,
        notes,
        beforeImages,
        afterImages,
        xrayImages,
        followUpRequired,
        followUpDate,
        complications,
        patientReaction
      } = req.body;

      // Validate required fields
      if (!patient || !doctor || !treatmentDate || !treatmentType || !diagnosis || !treatment || !totalCost) {
        return res.status(400).json({ 
          message: "Thiếu thông tin bắt buộc: patient, doctor, treatmentDate, treatmentType, diagnosis, treatment, totalCost" 
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

      // If appointment is provided, check if it exists and update it
      if (appointment) {
        const appointmentExists = await Appointment.findById(appointment);
        if (!appointmentExists) {
          return res.status(404).json({ message: "Không tìm thấy cuộc hẹn" });
        }
        
        // Update appointment status to completed
        await Appointment.findByIdAndUpdate(appointment, { 
          status: "Completed",
          actualCost: totalCost
        });
      }

      const treatmentRecord = new Treatment({
        patient,
        doctor,
        appointment,
        treatmentDate: new Date(treatmentDate),
        treatmentType,
        teeth,
        diagnosis,
        treatment,
        medications,
        materials,
        procedures,
        totalCost,
        notes,
        beforeImages,
        afterImages,
        xrayImages,
        followUpRequired: followUpRequired || false,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        complications,
        patientReaction,
        treatmentStatus: followUpRequired ? "Requires Follow-up" : "Completed"
      });

      const savedTreatment = await treatmentRecord.save();
      
      // Populate the saved treatment with doctor and patient details
      const populatedTreatment = await Treatment.findById(savedTreatment._id)
        .populate('doctor', 'name email expertise')
        .populate('patient', 'name email phone')
        .populate('appointment', 'appointmentDate appointmentTime treatmentType');

      res.status(201).json({
        message: "Tạo hồ sơ điều trị thành công",
        data: populatedTreatment
      });
    } catch (err) {
      console.error("Error creating treatment:", err);
      res.status(400).json({ 
        message: "Lỗi khi tạo hồ sơ điều trị",
        error: err.message 
      });
    }
  }

  // Lấy tất cả hồ sơ điều trị
  async getAllTreatments(req, res) {
    try {
      const { patient, doctor, treatmentType, status } = req.query;
      let filter = {};

      if (patient) filter.patient = patient;
      if (doctor) filter.doctor = doctor;
      if (treatmentType) filter.treatmentType = new RegExp(treatmentType, 'i');
      if (status) filter.treatmentStatus = status;

      const treatments = await Treatment.find(filter)
        .populate('doctor', 'name email expertise')
        .populate('patient', 'name email phone')
        .populate('appointment', 'appointmentDate appointmentTime')
        .sort({ treatmentDate: -1 });
      
      res.status(200).json({
        message: "Lấy danh sách hồ sơ điều trị thành công",
        count: treatments.length,
        data: treatments
      });
    } catch (err) {
      console.error("Error fetching treatments:", err);
      res.status(500).json({ 
        message: "Lỗi khi lấy danh sách hồ sơ điều trị",
        error: err.message 
      });
    }
  }

  // Lấy hồ sơ điều trị theo ID
  async getTreatmentById(req, res) {
    try {
      const { id } = req.params;
      const treatment = await Treatment.findById(id)
        .populate('doctor', 'name email expertise phone')
        .populate('patient', 'name email phone address')
        .populate('appointment', 'appointmentDate appointmentTime treatmentType status');

      if (!treatment) {
        return res.status(404).json({ 
          message: "Không tìm thấy hồ sơ điều trị" 
        });
      }

      res.status(200).json({
        message: "Lấy thông tin hồ sơ điều trị thành công",
        data: treatment
      });
    } catch (err) {
      console.error("Error fetching treatment by ID:", err);
      res.status(500).json({ 
        message: "Lỗi khi lấy thông tin hồ sơ điều trị",
        error: err.message 
      });
    }
  }

  // Cập nhật hồ sơ điều trị
  async updateTreatment(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Remove fields that shouldn't be updated directly
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      const updatedTreatment = await Treatment.findByIdAndUpdate(
        id, 
        updateData, 
        { new: true, runValidators: true }
      ).populate('doctor', 'name email expertise')
       .populate('patient', 'name email phone')
       .populate('appointment', 'appointmentDate appointmentTime');

      if (!updatedTreatment) {
        return res.status(404).json({ 
          message: "Không tìm thấy hồ sơ điều trị để cập nhật" 
        });
      }

      res.status(200).json({
        message: "Cập nhật hồ sơ điều trị thành công",
        data: updatedTreatment
      });
    } catch (err) {
      console.error("Error updating treatment:", err);
      res.status(400).json({ 
        message: "Lỗi khi cập nhật hồ sơ điều trị",
        error: err.message 
      });
    }
  }

  // Xóa hồ sơ điều trị
  async deleteTreatment(req, res) {
    try {
      const { id } = req.params;
      const deletedTreatment = await Treatment.findByIdAndDelete(id);

      if (!deletedTreatment) {
        return res.status(404).json({ 
          message: "Không tìm thấy hồ sơ điều trị để xóa" 
        });
      }

      res.status(200).json({
        message: "Xóa hồ sơ điều trị thành công",
        data: deletedTreatment
      });
    } catch (err) {
      console.error("Error deleting treatment:", err);
      res.status(500).json({ 
        message: "Lỗi khi xóa hồ sơ điều trị",
        error: err.message 
      });
    }
  }

  // Lấy hồ sơ điều trị theo bệnh nhân
  async getTreatmentsByPatient(req, res) {
    try {
      const { patientId } = req.params;
      
      const treatments = await Treatment.find({ patient: patientId })
        .populate('doctor', 'name email expertise')
        .populate('appointment', 'appointmentDate appointmentTime')
        .sort({ treatmentDate: -1 });

      res.status(200).json({
        message: "Lấy hồ sơ điều trị theo bệnh nhân thành công",
        patientId,
        count: treatments.length,
        data: treatments
      });
    } catch (err) {
      console.error("Error fetching treatments by patient:", err);
      res.status(500).json({ 
        message: "Lỗi khi lấy hồ sơ điều trị theo bệnh nhân",
        error: err.message 
      });
    }
  }

  // Lấy hồ sơ điều trị theo bác sĩ
  async getTreatmentsByDoctor(req, res) {
    try {
      const { doctorId } = req.params;
      const { startDate, endDate } = req.query;

      let filter = { doctor: doctorId };
      
      if (startDate && endDate) {
        filter.treatmentDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const treatments = await Treatment.find(filter)
        .populate('patient', 'name email phone')
        .populate('appointment', 'appointmentDate appointmentTime')
        .sort({ treatmentDate: -1 });

      res.status(200).json({
        message: "Lấy hồ sơ điều trị theo bác sĩ thành công",
        doctorId,
        count: treatments.length,
        data: treatments
      });
    } catch (err) {
      console.error("Error fetching treatments by doctor:", err);
      res.status(500).json({ 
        message: "Lỗi khi lấy hồ sơ điều trị theo bác sĩ",
        error: err.message 
      });
    }
  }

  // Lấy thống kê điều trị
  async getTreatmentStats(req, res) {
    try {
      const totalTreatments = await Treatment.countDocuments();
      const completedTreatments = await Treatment.countDocuments({ treatmentStatus: "Completed" });
      const inProgressTreatments = await Treatment.countDocuments({ treatmentStatus: "In-Progress" });
      const followUpRequired = await Treatment.countDocuments({ treatmentStatus: "Requires Follow-up" });
      
      const totalRevenue = await Treatment.aggregate([
        { $group: { _id: null, total: { $sum: "$totalCost" } } }
      ]);

      const treatmentTypeStats = await Treatment.aggregate([
        { $group: { _id: "$treatmentType", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      res.status(200).json({
        message: "Lấy thống kê điều trị thành công",
        data: {
          totalTreatments,
          completedTreatments,
          inProgressTreatments,
          followUpRequired,
          totalRevenue: totalRevenue[0]?.total || 0,
          treatmentTypeStats
        }
      });
    } catch (err) {
      console.error("Error fetching treatment stats:", err);
      res.status(500).json({ 
        message: "Lỗi khi lấy thống kê điều trị",
        error: err.message 
      });
    }
  }
}

module.exports = new TreatmentController();