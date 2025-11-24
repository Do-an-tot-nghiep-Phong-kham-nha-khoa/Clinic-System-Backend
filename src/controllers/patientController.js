const Patient = require('../models/patient');
const Account = require('../models/account');
const Role = require('../models/role');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const uploadCloudinary = require('../middlewares/uploadCloudinary');



// ---------------------- CRUD for patients (admin / management) ----------------------

// [POST] /patients/
module.exports.createPatient = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { name, email, password, phone, dob, address, gender } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        message: "Thiếu thông tin bắt buộc: name, email, password, phone",
      });
    }

    // Kiểm tra account trùng email
    const existingAccount = await Account.findOne({ email });
    if (existingAccount) {
      return res.status(400).json({ message: "Email đã được sử dụng" });
    }

    // Kiểm tra phone trùng
    const existingPatient = await Patient.findOne({ phone });
    if (existingPatient) {
      return res.status(400).json({ message: "Số điện thoại đã được sử dụng" });
    }

    const patientRole = await Role.findOne({ name: 'patient' });
    if (!patientRole) {
      return res.status(500).json({ message: "Role patient chưa được cấu hình trong hệ thống!" });
    }

    // Validate gender nếu có
    if (gender && !['male', 'female', 'other'].includes(gender)) {
      return res.status(400).json({ message: 'Giới tính không hợp lệ!' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Lưu URL avatar nếu middleware multer-storage-cloudinary đã upload file
    let avatarUrl = '';
    if (req.file) {
      const result = await uploadCloudinary(req.file.buffer);
      avatarUrl = result.secure_url;
    }
    // Tạo account mới cho bệnh nhân
    const newAccount = new Account({
      email,
      password: hashedPassword,
      roleId: patientRole._id,
      avatar: avatarUrl
    });
    const savedAccount = await newAccount.save({ session });

    // Tạo patient record
    const newPatient = new Patient({
      accountId: savedAccount._id,
      name,
      phone,
      dob,
      address,
      gender
    });
    const savedPatient = await newPatient.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Tạo bệnh nhân thành công",
      data: savedPatient,
    });
  } catch (err) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating patient:", err);
    res.status(500).json({
      message: "Lỗi khi tạo bệnh nhân",
      error: err.message,
    });
  }
};

// [GET] /patients/
module.exports.getAllPatients = async (req, res) => {
  try {
    const { q, status, page = 1, limit = 10 } = req.query;
    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

    const filter = { deleted: false };
    if (status) filter.status = status;
    if (q) {
      const r = new RegExp(q, 'i');
      filter.$or = [{ name: r }, { email: r }, { phone: r }];
    }

    const [items, total] = await Promise.all([
      Patient.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
      Patient.countDocuments(filter),
    ]);

    return res.status(200).json({
      message: 'Lấy danh sách bệnh nhân thành công',
      count: items.length,
      data: items,
      pagination: {
        page: pageNumber,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error('Error fetching patients:', err);
    return res.status(500).json({ message: 'Lỗi khi lấy danh sách bệnh nhân', error: err.message });
  }
};

// [GET] /patients/:id
module.exports.getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Id không hợp lệ' });

    const patient = await Patient.findOne({ _id: id, deleted: false });
    if (!patient) return res.status(404).json({ message: 'Không tìm thấy bệnh nhân' });

    return res.status(200).json({ message: 'Lấy thông tin bệnh nhân thành công', data: patient });
  } catch (err) {
    console.error('Error fetching patient by id:', err);
    return res.status(500).json({ message: 'Lỗi khi lấy thông tin bệnh nhân', error: err.message });
  }
};


// [DELETE] /patients/:id  (soft delete)
module.exports.deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Id không hợp lệ' });

    const patient = await Patient.findById(id);
    if (!patient) return res.status(404).json({ message: 'Không tìm thấy bệnh nhân để xóa' });

    patient.deleted = true;
    patient.status = 'inactive';
    await patient.save();

    return res.status(200).json({ message: 'Xóa (soft) bệnh nhân thành công', data: patient });
  } catch (err) {
    console.error('Error deleting patient:', err);
    return res.status(500).json({ message: 'Lỗi khi xóa bệnh nhân', error: err.message });
  }
};
// [GET] /patients/account/:accountId
module.exports.getByAccountId = async (req, res) => {
  try {
    const { accountId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      return res.status(400).json({ message: 'Invalid accountId' });
    }

    let query = Patient.findOne({ accountId });
    if (String(req.query.populate).toLowerCase() === 'true') {
      query = query.populate('accountId');
    }
    const patient = await query.lean();

    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    return res.json(patient);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// [PUT] /patients/:id 
module.exports.updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ!' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'accountId')) {
      return res.status(400).json({ message: 'Không thể cập nhật accountId!' });
    }

    // Chỉ cho phép cập nhật các trường sau
    const allowedFields = ['name', 'dob', 'phone', 'address', 'gender'];
    const update = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    // Validate gender nếu có
    if (update.gender && !['male', 'female', 'other'].includes(update.gender)) {
      return res.status(400).json({ message: 'Giới tính không hợp lệ!' });
    }

    // Check unique phone nếu có cập nhật
    if (update.phone) {
      const exists = await Patient.findOne({ phone: update.phone, _id: { $ne: id } });
      if (exists) return res.status(400).json({ message: 'Số điện thoại đã tồn tại!' });
    }

    const updated = await Patient.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!updated) return res.status(404).json({ message: 'Không tìm thấy bệnh nhân!' });

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

