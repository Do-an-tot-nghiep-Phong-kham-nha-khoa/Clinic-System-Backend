const Doctor = require("../models/doctor");

class DoctorController {
  // Tạo bác sĩ mới (theo model mới: name, specialtyId, phone, email, password, experience, schedule[])
  async createDoctor(req, res) {
    try {
      const { name, specialtyId, phone, email, password, experience, schedule } = req.body;

      // Validate required fields
      if (!name || !specialtyId) {
        return res.status(400).json({
          message: "Thiếu thông tin bắt buộc: name, specialtyId"
        });
      }

      // Optional duplicate check for email/phone if provided
      if (email || phone) {
        const existingDoctor = await Doctor.findOne({
          $or: [email ? { email } : null, phone ? { phone } : null].filter(Boolean)
        });
        if (existingDoctor) {
          return res.status(400).json({
            message: "Bác sĩ với email hoặc số điện thoại này đã tồn tại"
          });
        }
      }

      // Basic schedule validation (if provided)
      let normalizedSchedule = undefined;
      if (Array.isArray(schedule)) {
        normalizedSchedule = schedule.map((s) => ({
          day: s.day,
          timeSlots: Array.isArray(s.timeSlots) ? s.timeSlots : []
        }));
      }

      const doctor = new Doctor({
        name,
        specialtyId,
        phone,
        email,
        password,
        experience,
        schedule: normalizedSchedule
      });
      const savedDoctor = await doctor.save();

      res.status(201).json({
        message: "Tạo bác sĩ thành công",
        data: savedDoctor
      });
    } catch (err) {
      console.error("Error creating doctor:", err);
      res.status(400).json({
        message: "Lỗi khi tạo bác sĩ",
        error: err.message
      });
    }
  }

  // Lấy danh sách tất cả bác sĩ
  async getAllDoctors(req, res) {
    try {
      console.log("Fetching all doctors...");
      // Support filter by specialtyId and name via query + pagination
      const { specialtyId, name, page = 1, limit = 10 } = req.query;
      const filter = {};
      if (specialtyId) filter.specialtyId = specialtyId;
      if (name) filter.name = new RegExp(name, "i");

      const pageNumber = Math.max(parseInt(page) || 1, 1);
      const pageSize = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

      const [items, total] = await Promise.all([
        Doctor.find(filter)
          .skip((pageNumber - 1) * pageSize)
          .limit(pageSize),
        Doctor.countDocuments(filter)
      ]);
      
      res.status(200).json({
        message: "Lấy danh sách bác sĩ thành công",
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
      console.error("Error fetching doctors:", err);
      res.status(500).json({ 
        message: "Lỗi khi lấy danh sách bác sĩ",
        error: err.message 
      });
    }
  }

  // Lấy thông tin bác sĩ theo ID
  async getDoctorById(req, res) {
    try {
      const { id } = req.params;
      const doctor = await Doctor.findById(id);

      if (!doctor) {
        return res.status(404).json({ 
          message: "Không tìm thấy bác sĩ" 
        });
      }

      res.status(200).json({
        message: "Lấy thông tin bác sĩ thành công",
        data: doctor
      });
    } catch (err) {
      console.error("Error fetching doctor by ID:", err);
      res.status(500).json({ 
        message: "Lỗi khi lấy thông tin bác sĩ",
        error: err.message 
      });
    }
  }

  // Cập nhật thông tin bác sĩ
  async updateDoctor(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Remove fields that shouldn't be updated directly
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      const updatedDoctor = await Doctor.findByIdAndUpdate(
        id, 
        updateData, 
        { new: true, runValidators: true }
      );

      if (!updatedDoctor) {
        return res.status(404).json({ 
          message: "Không tìm thấy bác sĩ để cập nhật" 
        });
      }

      res.status(200).json({
        message: "Cập nhật thông tin bác sĩ thành công",
        data: updatedDoctor
      });
    } catch (err) {
      console.error("Error updating doctor:", err);
      res.status(400).json({ 
        message: "Lỗi khi cập nhật thông tin bác sĩ",
        error: err.message 
      });
    }
  }

  // Xóa bác sĩ
  async deleteDoctor(req, res) {
    try {
      const { id } = req.params;
      const deletedDoctor = await Doctor.findByIdAndDelete(id);

      if (!deletedDoctor) {
        return res.status(404).json({ 
          message: "Không tìm thấy bác sĩ để xóa" 
        });
      }

      res.status(200).json({
        message: "Xóa bác sĩ thành công",
        data: deletedDoctor
      });
    } catch (err) {
      console.error("Error deleting doctor:", err);
      res.status(500).json({ 
        message: "Lỗi khi xóa bác sĩ",
        error: err.message 
      });
    }
  }

  // Tìm kiếm bác sĩ theo tên, email, phone hoặc ngày làm việc
  async searchDoctors(req, res) {
    try {
  const { query, page = 1, limit = 10 } = req.query;

      if (!query) {
        return res.status(400).json({ 
          message: "Vui lòng cung cấp từ khóa tìm kiếm" 
        });
      }

      const searchRegex = new RegExp(query, 'i');
      const filter = {
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { "schedule.day": searchRegex }
        ]
      };

      const pageNumber = Math.max(parseInt(page) || 1, 1);
      const pageSize = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

      const [items, total] = await Promise.all([
        Doctor.find(filter)
          .skip((pageNumber - 1) * pageSize)
          .limit(pageSize),
        Doctor.countDocuments(filter)
      ]);

      res.status(200).json({
        message: "Tìm kiếm bác sĩ thành công",
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
      console.error("Error searching doctors:", err);
      res.status(500).json({ 
        message: "Lỗi khi tìm kiếm bác sĩ",
        error: err.message 
      });
    }
  }

  // Lấy bác sĩ theo chuyên khoa (mapping route param 'expertise' -> specialtyId)
  async getDoctorsByExpertise(req, res) {
    try {
      const { expertise } = req.params; // actually specialtyId
      const doctors = await Doctor.find({ specialtyId: expertise });

      res.status(200).json({
        message: "Lấy danh sách bác sĩ theo chuyên khoa (specialty) thành công",
        specialtyId: expertise,
        count: doctors.length,
        data: doctors
      });
    } catch (err) {
      console.error("Error fetching doctors by expertise:", err);
      res.status(500).json({ 
        message: "Lỗi khi lấy danh sách bác sĩ theo chuyên khoa",
        error: err.message 
      });
    }
  }
}

module.exports = new DoctorController();
