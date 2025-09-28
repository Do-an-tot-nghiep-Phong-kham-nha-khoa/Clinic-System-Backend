const Doctor = require("../models/doctor");

class DoctorController {
  // Tạo bác sĩ mới
  async createDoctor(req, res) {
    try {
      const { name, phone, email, gender, address, expertise } = req.body;

      // Validate required fields
      if (!name || !phone || !email || !gender || !expertise) {
        return res.status(400).json({ 
          message: "Thiếu thông tin bắt buộc: name, phone, email, gender, expertise" 
        });
      }

      // Check if doctor with same email or phone already exists
      const existingDoctor = await Doctor.findOne({ 
        $or: [{ email }, { phone }] 
      });

      if (existingDoctor) {
        return res.status(400).json({ 
          message: "Bác sĩ với email hoặc số điện thoại này đã tồn tại" 
        });
      }

      const doctor = new Doctor({ name, phone, email, gender, address, expertise });
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
      const doctors = await Doctor.find().sort({ createdAt: -1 });
      
      res.status(200).json({
        message: "Lấy danh sách bác sĩ thành công",
        count: doctors.length,
        data: doctors
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

  // Tìm kiếm bác sĩ theo tên hoặc chuyên khoa
  async searchDoctors(req, res) {
    try {
      const { query } = req.query;

      if (!query) {
        return res.status(400).json({ 
          message: "Vui lòng cung cấp từ khóa tìm kiếm" 
        });
      }

      const searchRegex = new RegExp(query, 'i');
      const doctors = await Doctor.find({
        $or: [
          { name: searchRegex },
          { "expertise.name": searchRegex },
          { "expertise.description": searchRegex }
        ]
      }).sort({ createdAt: -1 });

      res.status(200).json({
        message: "Tìm kiếm bác sĩ thành công",
        count: doctors.length,
        data: doctors
      });
    } catch (err) {
      console.error("Error searching doctors:", err);
      res.status(500).json({ 
        message: "Lỗi khi tìm kiếm bác sĩ",
        error: err.message 
      });
    }
  }

  // Lấy bác sĩ theo chuyên khoa
  async getDoctorsByExpertise(req, res) {
    try {
      const { expertise } = req.params;
      const searchRegex = new RegExp(expertise, 'i');
      
      const doctors = await Doctor.find({
        "expertise.name": searchRegex
      }).sort({ createdAt: -1 });

      res.status(200).json({
        message: "Lấy danh sách bác sĩ theo chuyên khoa thành công",
        expertise: expertise,
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
