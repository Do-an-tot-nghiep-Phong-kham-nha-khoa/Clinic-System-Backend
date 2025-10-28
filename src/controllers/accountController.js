const Account = require('../models/account');
const Role = require('../models/role');
const Patient = require('../models/patient');
const ForgotPassword = require('../models/forgotPassword');
const generateHelper = require('../helpers/generate');
const sendMailHelper = require('../helpers/sendMail');
const bcrypt = require('bcrypt');

// [POST] /accounts/register
module.exports.register = async (req, res) => {
  try {
    const { email, password, fullName, phone, dob, gender, address } = req.body;

    // Kiểm tra email trùng
    const existAccount = await Account.findOne({ email });
    if (existAccount) {
      return res.status(400).json({ message: "Email đã tồn tại!" });
    }

    // Tìm role "patient"
    const patientRole = await Role.findOne({ name: 'patient' });
    if (!patientRole) {
      return res.status(500).json({ message: "Role patient chưa được cấu hình trong hệ thống!" });
    }

    // Tạo account
    const hashedPassword = bcrypt.hashSync(password, 10);
    const newAccount = new Account({
      email,
      password: hashedPassword,
      roleId: patientRole._id
    });
    await newAccount.save();

    // Tạo patient profile đi kèm
    const newPatient = new Patient({
      accountId: newAccount._id,
      name: fullName,
      phone,
      dob,
      gender,
      address
    });
    await newPatient.save();

    // Gắn cookie để tự động login sau đăng ký
    res.cookie("tokenUser", newAccount.tokenUser);
    return res.status(201).json({ message: "Đăng ký thành công!", accountId: newAccount._id });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi khi đăng ký tài khoản!" });
  }
};


// [POST] /accounts/login
module.exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const account = await Account.findOne({ email, deleted: false }).populate('roleId');
    if (!account) {
      return res.status(400).json({ message: "Email không tồn tại!" });
    }

    const isPasswordValid = bcrypt.compareSync(password, account.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Sai mật khẩu!" });
    }

    if (account.status === 'inactive') {
      return res.status(400).json({ message: "Tài khoản đang bị khóa!" });
    }

    res.cookie("tokenUser", account.tokenUser);
    return res.status(200).json({
      message: "Đăng nhập thành công!",
      role: account.roleId.name,
      tokenUser: account.tokenUser
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi khi đăng nhập!" });
  }
};

// [GET] /accounts/logout
module.exports.logout = async (req, res) => {
  try {
    res.clearCookie("tokenUser");
    return res.status(200).json({ message: "Đăng xuất thành công!" });
  } catch (error) {
    return res.status(500).json({ message: "Đăng xuất thất bại!" });
  }
};

// [POST] /accounts/password/forgot
module.exports.forgotPasswordPost = async (req, res) => {
  try {
    const { email } = req.body;
    const account = await Account.findOne({ email, deleted: false });
    if (!account) {
      return res.status(400).json({ message: "Email không tồn tại!" });
    }

    const otp = generateHelper.generateRandomNumber(8);
    const forgotPassword = new ForgotPassword({ email, otp });
    await forgotPassword.save();

    const subject = "Mã OTP xác minh lấy lại mật khẩu";
    const html = `Mã OTP để lấy lại mật khẩu là: <b>${otp}</b>. Thời hạn sử dụng là 3 phút.`;
    await sendMailHelper.sendMail(email, subject, html);

    return res.status(200).json({ message: "Đã gửi mã OTP về email của bạn!" });
  } catch (error) {
    return res.status(500).json({ message: "Không thể gửi OTP!" });
  }
};


// [POST] /accounts/password/otp
module.exports.otpPasswordPost = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const result = await ForgotPassword.findOne({ email, otp });
    if (!result) {
      return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn!" });
    }

    // Kiểm tra thời gian hết hạn
    if (Date.now() > new Date(result.expireAt).getTime()) {
      await ForgotPassword.deleteOne({ _id: result._id });
      return res.status(400).json({ message: "OTP đã hết hạn!" });
    }

    const account = await Account.findOne({ email, deleted: false, status: 'active' });
    if (!account) {
      return res.status(400).json({ message: "Tài khoản không hợp lệ!" });
    }

    res.cookie("tokenUser", account.tokenUser);
    return res.status(200).json({ message: "Xác thực OTP thành công!" });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi xác thực OTP!" });
  }
};

// [POST] /accounts/password/reset
module.exports.resetPasswordPost = async (req, res) => {
  try {
    const { password } = req.body;
    const tokenUser = req.cookies.tokenUser;
    if (!tokenUser) {
      return res.status(401).json({ message: "Thiếu token xác thực!" });
    }

    const hashed = bcrypt.hashSync(password, 10);
    await Account.updateOne({ tokenUser }, { password: hashed });

    return res.status(200).json({ message: "Đặt lại mật khẩu thành công!" });
  } catch (error) {
    return res.status(500).json({ message: "Không thể đặt lại mật khẩu!" });
  }
};