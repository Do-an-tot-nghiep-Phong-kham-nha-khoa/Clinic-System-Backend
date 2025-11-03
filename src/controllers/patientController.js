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
module.exports.update = async (req, res) => {
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

