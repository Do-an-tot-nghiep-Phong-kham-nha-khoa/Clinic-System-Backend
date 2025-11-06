// controllers/doctor.controller.js
const Doctor = require("../models/doctor");
const Schedule = require("../models/schedule");
const Account = require("../models/account");
const Role = require("../models/role");
const bcrypt = require("bcrypt");

class DoctorController {
  // Tạo bác sĩ mới (tạo kèm Account nếu cần)
  async createDoctor(req, res) {
    try {
      const { name, specialtyId, phone, email, password, experience } = req.body;

      if (!name || !specialtyId || !email || !password) {
        return res.status(400).json({
          message: "Thiếu thông tin bắt buộc: name, specialtyId, email, password",
        });
      }

      // Kiểm tra account trùng email
      const existingAccount = await Account.findOne({ email });
      if (existingAccount) {
        return res.status(400).json({ message: "Email đã được sử dụng" });
      }

      const doctorRole = await Role.findOne({ name: 'doctor' });
      if (!doctorRole) {
        return res.status(500).json({ message: "Role doctor chưa được cấu hình trong hệ thống!" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Tạo account mới cho bác sĩ
      const newAccount = new Account({
        email,
        password: hashedPassword,
        roleId: doctorRole._id, // Đính ID role bác sĩ
      });
      const savedAccount = await newAccount.save();

      // Tạo doctor record
      const newDoctor = new Doctor({
        accountId: savedAccount._id,
        name,
        specialtyId,
        phone,
        experience,
      });
      const savedDoctor = await newDoctor.save();

      res.status(201).json({
        message: "Tạo bác sĩ thành công",
        data: savedDoctor,
      });
    } catch (err) {
      console.error("Error creating doctor:", err);
      res.status(500).json({
        message: "Lỗi khi tạo bác sĩ",
        error: err.message,
      });
    }
  }

  // Lấy danh sách bác sĩ (lọc theo chuyên khoa, phân trang)
  async getAllDoctors(req, res) {
    try {
      const { specialtyId, name, page = 1, limit = 10 } = req.query;
      const filter = {};

      if (specialtyId) filter.specialtyId = specialtyId;
      if (name) filter.name = new RegExp(name, "i");

      const pageNumber = Math.max(parseInt(page), 1);
      const pageSize = Math.min(parseInt(limit), 100);

      const [doctors, total] = await Promise.all([
        Doctor.find(filter)
          .populate("specialtyId", "name")
          .populate("accountId", "email status")
          .skip((pageNumber - 1) * pageSize)
          .limit(pageSize),
        Doctor.countDocuments(filter),
      ]);

      res.status(200).json({
        message: "Lấy danh sách bác sĩ thành công",
        data: doctors,
        pagination: {
          page: pageNumber,
          pageSize,
          totalItems: total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (err) {
      res.status(500).json({
        message: "Lỗi khi lấy danh sách bác sĩ",
        error: err.message,
      });
    }
  }

  // Lấy chi tiết bác sĩ theo ID (kèm lịch làm việc)
  async getDoctorById(req, res) {
    try {
      const { id } = req.params;
      const doctor = await Doctor.findById(id)
        .populate("specialtyId", "name")
        .populate("accountId", "email status");

      if (!doctor)
        return res.status(404).json({ message: "Không tìm thấy bác sĩ" });

      // Lấy lịch làm việc
      const schedules = await Schedule.find({ doctor_id: id });

      res.status(200).json({
        message: "Lấy thông tin bác sĩ thành công",
        data: { doctor, schedules },
      });
    } catch (err) {
      res.status(500).json({
        message: "Lỗi khi lấy thông tin bác sĩ",
        error: err.message,
      });
    }
  }

  // Cập nhật thông tin bác sĩ
  async updateDoctor(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updatedDoctor = await Doctor.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updatedDoctor)
        return res.status(404).json({ message: "Không tìm thấy bác sĩ" });

      res.status(200).json({
        message: "Cập nhật bác sĩ thành công",
        data: updatedDoctor,
      });
    } catch (err) {
      res.status(500).json({
        message: "Lỗi khi cập nhật bác sĩ",
        error: err.message,
      });
    }
  }

  // Xóa bác sĩ
  async deleteDoctor(req, res) {
    try {
      const { id } = req.params;
      const doctor = await Doctor.findByIdAndDelete(id);
      if (!doctor)
        return res.status(404).json({ message: "Không tìm thấy bác sĩ" });

      // Optionally: xóa luôn account hoặc schedule liên quan
      await Account.findByIdAndDelete(doctor.accountId);
      await Schedule.deleteMany({ doctor_id: id });

      res.status(200).json({
        message: "Xóa bác sĩ và dữ liệu liên quan thành công",
      });
    } catch (err) {
      res.status(500).json({
        message: "Lỗi khi xóa bác sĩ",
        error: err.message,
      });
    }
  }

  // Lọc bác sĩ theo chuyên khoa
  async getDoctorsBySpecialty(req, res) {
    try {
      const { specialtyId } = req.params;
      const doctors = await Doctor.find({ specialtyId })
        .populate("specialtyId", "name")
        .populate("accountId", "email status");

      res.status(200).json({
        message: "Lấy danh sách bác sĩ theo chuyên khoa thành công",
        count: doctors.length,
        data: doctors,
      });
    } catch (err) {
      res.status(500).json({
        message: "Lỗi khi lấy bác sĩ theo chuyên khoa",
        error: err.message,
      });
    }
  }
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
  // Lấy bác sĩ theo account id
  async getDoctorByAccountId(req, res) {
    try {
      const { accountId } = req.params;
      const doctor = await Doctor.findOne({ accountId })
        .populate("specialtyId", "name")
        .populate("accountId", "email status");
      if (!doctor) {
        return res.status(404).json({ message: "Không tìm thấy bác sĩ" });
      }
      res.status(200).json({
        message: "Lấy thông tin bác sĩ thành công",
        data: doctor,
      });
    }
    catch (err) {
      res.status(500).json({
        message: "Lỗi khi lấy thông tin bác sĩ",
        error: err.message,
      });
    }
  }
}

module.exports = new DoctorController();
