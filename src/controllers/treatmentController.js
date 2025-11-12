const Treatment = require("../models/treatment");
const Doctor = require("../models/doctor");
const Patient = require("../models/patient");
const Appointment = require("../models/appointment");
const FamilyMember = require("../models/familyMember");
const LabOrder = require("../models/labOrder");
const Prescription = require("../models/prescription");
const HealthProfile = require("../models/healthProfile");
const Invoice = require("../models/invoice");

class TreatmentController {
  // Tạo hồ sơ điều trị mới
  async createTreatment(req, res) {
    try {
      const {
        healthProfile,
        doctor,
        appointment,
        treatmentDate,
        diagnosis,
        prescription,
        laborder,
        bloodPressure,
        heartRate,
        temperature,
        symptoms
      } = req.body;

      if (!healthProfile || !doctor || !treatmentDate || !diagnosis) {
        return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
      }

      const hp = await HealthProfile.findById(healthProfile);
      if (!hp) return res.status(404).json({ message: "Không tìm thấy health profile" });

      const doctorExists = await Doctor.findById(doctor);
      if (!doctorExists) return res.status(404).json({ message: "Không tìm thấy bác sĩ" });

      let labOrderPrice = 0, prescriptionPrice = 0;

      if (laborder) {
        const labOrderDoc = await LabOrder.findById(laborder);
        if (!labOrderDoc) return res.status(404).json({ message: "Không tìm thấy LabOrder" });
        labOrderPrice = labOrderDoc.totalPrice || 0;
      }

      if (prescription) {
        const prescriptionDoc = await Prescription.findById(prescription);
        if (!prescriptionDoc) return res.status(404).json({ message: "Không tìm thấy Prescription" });
        prescriptionPrice = prescriptionDoc.totalPrice || 0;
      }

      const totalCost = labOrderPrice + prescriptionPrice;

      if (appointment) {
        await Appointment.findByIdAndUpdate(appointment, { status: "completed" })
      }

      const saved = await Treatment.create({
        healthProfile,
        doctor,
        appointment,
        treatmentDate,
        diagnosis,
        laborder,
        prescription,
        bloodPressure,
        heartRate,
        temperature,
        symptoms,
        totalCost
      });

      const populatedTreatment = await Treatment.findById(saved._id)
        .populate('doctor', 'name')
        .populate('appointment', 'appointmentDate')
        .populate('healthProfile',);

      // append owner_detail giống appointment API
      const ownerModel = populatedTreatment.healthProfile.ownerModel;
      const ownerId = populatedTreatment.healthProfile.ownerId;

      let ownerModelRef = ownerModel === "Patient" ? Patient : FamilyMember;
      const owner = await ownerModelRef.findById(ownerId).select("name dob phone gender");

      populatedTreatment.healthProfile = {
        ...populatedTreatment.healthProfile.toObject(),
        owner_detail: owner
      }

      // create invoice
      let createdInvoice = null;
      if (prescription || laborder) {
        try {
          const invoiceTotal = totalCost; // đã tính ở trên (labOrderPrice + prescriptionPrice)

          const invoice = new Invoice({
            totalPrice: invoiceTotal,
            status: 'Pending',
            healthProfile_id: healthProfile,
            created_at: treatmentDate,
            prescriptionId: prescription || null,
            labOrderId: laborder || null,
          });

          createdInvoice = await invoice.save();
        } catch (invoiceError) {
          console.log("Lỗi khi tạo Invoice:", invoiceError.message);
        }
      }

      res.status(201).json({
        message: "Tạo treatment thành công",
        data: populatedTreatment
      });

    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  }

  // Lấy tất cả hồ sơ điều trị (hỗ trợ tìm kiếm + phân trang)
  async getAllTreatments(req, res) {
    try {
      const { patient, doctor, treatmentType, status, q, page = 1, limit = 10 } = req.query;
      let filter = {};

      if (patient) filter.patient = patient;
      if (doctor) filter.doctor = doctor;
      if (treatmentType) filter.treatmentType = new RegExp(treatmentType, 'i');
      if (status) filter.treatmentStatus = status;

      // Free text search across key fields
      if (q) {
        const searchRegex = new RegExp(q, 'i');
        filter.$or = [
          { treatmentType: searchRegex },
          { diagnosis: searchRegex },
          { treatment: searchRegex },
          { patientReaction: searchRegex }
        ];
      }

      const pageNumber = Math.max(parseInt(page) || 1, 1);
      const pageSize = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

      const [items, total] = await Promise.all([
        Treatment.find(filter)
          .populate('doctor', 'name email expertise')
          .populate('patient', 'name email phone')
          .populate('appointment', 'appointmentDate appointmentTime')
          .sort({ treatmentDate: -1 })
          .skip((pageNumber - 1) * pageSize)
          .limit(pageSize),
        Treatment.countDocuments(filter)
      ]);

      res.status(200).json({
        message: "Lấy danh sách hồ sơ điều trị thành công",
        count: items.length,
        data: items,
        pagination: {
          page: pageNumber,
          pageSize,
          totalItems: total,
          totalPages: Math.ceil(total / pageSize)
        }
      });
    } catch (err) {
      console.error("Error fetching treatments:", err);
      res.status(500).json({
        message: "Error fetching treatment records",
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

  // Lấy hồ sơ điều trị theo bệnh nhân (phân trang)
  async getTreatmentsByPatient(req, res) {
    try {
      const { patientId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const pageNumber = Math.max(parseInt(page) || 1, 1);
      const pageSize = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

      const filter = { patient: patientId };
      const [items, total] = await Promise.all([
        Treatment.find(filter)
          .populate('doctor', 'name email expertise')
          .populate('appointment', 'appointmentDate appointmentTime')
          .sort({ treatmentDate: -1 })
          .skip((pageNumber - 1) * pageSize)
          .limit(pageSize),
        Treatment.countDocuments(filter)
      ]);

      res.status(200).json({
        message: "Lấy hồ sơ điều trị theo bệnh nhân thành công",
        patientId,
        count: items.length,
        data: items,
        pagination: {
          page: pageNumber,
          pageSize,
          totalItems: total,
          totalPages: Math.ceil(total / pageSize)
        }
      });
    } catch (err) {
      console.error("Error fetching treatments by patient:", err);
      res.status(500).json({
        message: "Lỗi khi lấy hồ sơ điều trị theo bệnh nhân",
        error: err.message
      });
    }
  }

  // Lấy hồ sơ điều trị theo bác sĩ (phân trang)
  async getTreatmentsByDoctor(req, res) {
    try {
      const { doctorId } = req.params;
      const { startDate, endDate, page = 1, limit = 10 } = req.query;

      let filter = { doctor: doctorId };

      if (startDate && endDate) {
        filter.treatmentDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const pageNumber = Math.max(parseInt(page) || 1, 1);
      const pageSize = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

      const [items, total] = await Promise.all([
        Treatment.find(filter)
          .populate('patient', 'name email phone')
          .populate('appointment', 'appointmentDate appointmentTime')
          .sort({ treatmentDate: -1 })
          .skip((pageNumber - 1) * pageSize)
          .limit(pageSize),
        Treatment.countDocuments(filter)
      ]);

      res.status(200).json({
        message: "Lấy hồ sơ điều trị theo bác sĩ thành công",
        doctorId,
        count: items.length,
        data: items,
        pagination: {
          page: pageNumber,
          pageSize,
          totalItems: total,
          totalPages: Math.ceil(total / pageSize)
        }
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