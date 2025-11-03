const Patient = require('../models/patient');
const ForgotPassword = require('../models/forgotPassword');
const generateHelper = require('../helpers/generate');
const sendMailHelper = require('../helpers/sendMail');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

// [POST] /patients/register
module.exports.register = async (req, res) => {
  const existEmail = await Patient.findOne({ email: req.body.email });
  if (existEmail) {
    return res.status(400).json({ message: "Email đã tồn tại!" });
  }

  req.body.password = bcrypt.hashSync(req.body.password, 10);
  const patient = new Patient(req.body);
  await patient.save();
  res.cookie("tokenUser", patient.tokenUser);
  return res.status(201).json({ message: "Đăng ký thành công!" });
};

// [POST] /patients/login
module.exports.login = async (req, res) => {
  const { email, password } = req.body;
  const patient = await Patient.findOne({ email, deleted: false });
  if (!patient) return res.status(400).json({ message: "Email không tồn tại!" });
  if (!bcrypt.compareSync(password, patient.password))
    return res.status(400).json({ message: "Sai mật khẩu!" });
  if (patient.status === 'inactive')
    return res.status(400).json({ message: "Tài khoản đang bị khóa!" });

  res.cookie("tokenUser", patient.tokenUser);
  return res.status(200).json({ message: "Đăng nhập thành công!" });
};

// [GET] /patients/logout
module.exports.logout = async (req, res) => {
  try {
    res.clearCookie("tokenUser");
    return res.status(200).json({ message: "Đăng xuất thành công!" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ message: "Đăng xuất thất bại!" });
  }
};

// [POST] /patients/password/forgot
module.exports.forgotPasswordPost = async (req, res) => {
  const { email } = req.body;
  const patient = await Patient.findOne({ email, deleted: false });
  if (!patient) return res.status(400).json({ message: "Email không tồn tại!" });

  const otp = generateHelper.generateRandomNumber(8);
  const forgotPassword = new ForgotPassword({ email, otp });

  await forgotPassword.save();

  const subject = "Mã OTP xác minh lấy lại mật khẩu";
  const html = `Mã OTP để lấy lại mật khẩu là: <b>${otp}</b>. Thời hạn để sử dụng là 3 phút.`;
  await sendMailHelper.sendMail(email, subject, html);

  return res.status(200).json({ message: "Đã gửi mã OTP về email của bạn!" });
};

// [POST] /patients/password/otp
module.exports.otpPasswordPost = async (req, res) => {
  const { email, otp } = req.body;
  const result = await ForgotPassword.findOne({ email, otp });
  if (!result)
    return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn!" });

  if (Date.now() > new Date(result.expireAt).getTime()) {
    await ForgotPassword.deleteOne({ _id: result._id });
    return res.status(400).json({ message: "OTP đã hết hạn!" });
  }

  const patient = await Patient.findOne({ email, deleted: false, status: 'active' });
  if (!patient)
    return res.status(400).json({ message: "Tài khoản không hợp lệ!" });

  res.cookie("tokenUser", patient.tokenUser);
  return res.status(200).json({ message: "Xác thực OTP thành công!" });
};

// [POST] /patients/password/reset
module.exports.resetPasswordPost = async (req, res) => {
  const { password } = req.body;
  const tokenUser = req.cookies.tokenUser;
  if (!tokenUser)
    return res.status(401).json({ message: "Thiếu token xác thực!" });

  await Patient.updateOne(
    { tokenUser },
    { password: bcrypt.hashSync(password, 10) }
  );
  return res.status(200).json({ message: "Đặt lại mật khẩu thành công!" });
};

// ---------------------- CRUD for patients (admin / management) ----------------------

// [POST] /patients/create
module.exports.createPatient = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // optional duplicate checks
    if (email) {
      const exists = await Patient.findOne({ email });
      if (exists) return res.status(400).json({ message: 'Email đã tồn tại' });
    }
    if (phone) {
      const exists = await Patient.findOne({ phone });
      if (exists) return res.status(400).json({ message: 'Số điện thoại đã tồn tại' });
    }

    if (password) req.body.password = bcrypt.hashSync(password, 10);

    const patient = new Patient(req.body);
    const saved = await patient.save();
    return res.status(201).json({ message: 'Tạo bệnh nhân thành công', data: saved });
  } catch (err) {
    console.error('Error creating patient:', err);
    return res.status(500).json({ message: 'Lỗi khi tạo bệnh nhân', error: err.message });
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

// [PUT] /patients/:id
module.exports.updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Id không hợp lệ' });

    const updateData = { ...req.body };
    // prevent changing protected fields
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    if (updateData.password) {
      updateData.password = bcrypt.hashSync(updateData.password, 10);
    }

    const updated = await Patient.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: 'Không tìm thấy bệnh nhân để cập nhật' });

    return res.status(200).json({ message: 'Cập nhật bệnh nhân thành công', data: updated });
  } catch (err) {
    console.error('Error updating patient:', err);
    return res.status(400).json({ message: 'Lỗi khi cập nhật bệnh nhân', error: err.message });
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
