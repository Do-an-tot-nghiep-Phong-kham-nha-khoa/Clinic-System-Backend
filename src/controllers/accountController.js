const Account = require('../models/account');
const ForgotPassword = require('../models/forgotPassword');
const generateHelper = require('../helpers/generate');
const sendMailHelper = require('../helpers/sendMail');
const bcrypt = require('bcrypt');

// [POST] /accounts/register
module.exports.register = async (req, res) => {
  const existEmail = await Account.findOne({ email: req.body.email });
  if (existEmail) {
    return res.status(400).json({ message: "Email đã tồn tại!" });
  }

  req.body.password = bcrypt.hashSync(req.body.password, 10);
  const Account = new Account(req.body);
  await Account.save();
  res.cookie("tokenUser", Account.tokenUser);
  return res.status(201).json({ message: "Đăng ký thành công!" });
};

// [POST] /accounts/login
module.exports.login = async (req, res) => {
  const { email, password } = req.body;
  const Account = await Account.findOne({ email, deleted: false });
  if (!Account) return res.status(400).json({ message: "Email không tồn tại!" });
  if (!bcrypt.compareSync(password, Account.password))
    return res.status(400).json({ message: "Sai mật khẩu!" });
  if (Account.status === 'inactive')
    return res.status(400).json({ message: "Tài khoản đang bị khóa!" });

  res.cookie("tokenUser", Account.tokenUser);
  return res.status(200).json({ message: "Đăng nhập thành công!" });
};

// [GET] /accounts/logout
module.exports.logout = async (req, res) => {
  try {
    res.clearCookie("tokenUser");
    return res.status(200).json({ message: "Đăng xuất thành công!" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ message: "Đăng xuất thất bại!" });
  }
};

// [POST] /accounts/password/forgot
module.exports.forgotPasswordPost = async (req, res) => {
  const { email } = req.body;
  const Account = await Account.findOne({ email, deleted: false });
  if (!Account) return res.status(400).json({ message: "Email không tồn tại!" });

  const otp = generateHelper.generateRandomNumber(8);
  const forgotPassword = new ForgotPassword({ email, otp });

  await forgotPassword.save();

  const subject = "Mã OTP xác minh lấy lại mật khẩu";
  const html = `Mã OTP để lấy lại mật khẩu là: <b>${otp}</b>. Thời hạn để sử dụng là 3 phút.`;
  await sendMailHelper.sendMail(email, subject, html);

  return res.status(200).json({ message: "Đã gửi mã OTP về email của bạn!" });
};

// [POST] /accounts/password/otp
module.exports.otpPasswordPost = async (req, res) => {
  const { email, otp } = req.body;
  const result = await ForgotPassword.findOne({ email, otp });
  if (!result)
    return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn!" });

  if (Date.now() > new Date(result.expireAt).getTime()) {
    await ForgotPassword.deleteOne({ _id: result._id });
    return res.status(400).json({ message: "OTP đã hết hạn!" });
  }

  const Account = await Account.findOne({ email, deleted: false, status: 'active' });
  if (!Account)
    return res.status(400).json({ message: "Tài khoản không hợp lệ!" });

  res.cookie("tokenUser", Account.tokenUser);
  return res.status(200).json({ message: "Xác thực OTP thành công!" });
};

// [POST] /accounts/password/reset
module.exports.resetPasswordPost = async (req, res) => {
  const { password } = req.body;
  const tokenUser = req.cookies.tokenUser;
  if (!tokenUser)
    return res.status(401).json({ message: "Thiếu token xác thực!" });

  await Account.updateOne(
    { tokenUser },
    { password: bcrypt.hashSync(password, 10) }
  );
  return res.status(200).json({ message: "Đặt lại mật khẩu thành công!" });
};
