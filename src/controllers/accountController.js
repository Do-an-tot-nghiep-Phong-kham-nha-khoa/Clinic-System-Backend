const Account = require("../models/account");
const Role = require("../models/role");
const Patient = require("../models/patient");
const ForgotPassword = require("../models/forgotPassword");
const generateHelper = require("../helpers/generate");
const sendMailHelper = require("../helpers/sendMail");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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
    const patientRole = await Role.findOne({ name: "patient" });
    if (!patientRole) {
      return res
        .status(500)
        .json({ message: "Role patient chưa được cấu hình trong hệ thống!" });
    }

    // Tạo account
    const hashedPassword = await bcrypt.hash(password, 10);
    const newAccount = new Account({
      email,
      password: hashedPassword,
      roleId: patientRole._id,
    });
    await newAccount.save();

    // Tạo patient profile đi kèm
    const newPatient = new Patient({
      accountId: newAccount._id,
      name: fullName,
      phone,
      dob,
      gender,
      address,
    });
    try {
      await newPatient.save();
    } catch (err) {
      // Nếu tạo patient lỗi, rollback account đã tạo
      await Account.deleteOne({ _id: newAccount._id });

      // Kiểm tra lỗi duplicate key (ví dụ số điện thoại đã tồn tại)
      if (err && err.code === 11000) {
        const key = Object.keys(err.keyValue || {})[0];
        if (key === "phone") {
          return res
            .status(400)
            .json({ message: "Số điện thoại đã được sử dụng!" });
        }
        if (key === "accountId") {
          return res.status(400).json({ message: "Account đã tồn tại!" });
        }
        return res
          .status(400)
          .json({ message: `${key || "Trường"} đã tồn tại!` });
      }
      throw err;
    }

    // Populate roleId để lấy role name
    await newAccount.populate("roleId");

    // Gắn cookie để tự động login sau đăng ký
    const tokenUser = generateHelper.generateJWTToken(newAccount, {
      role: newAccount.roleId?.name,
    });
    res.cookie("tokenUser", tokenUser, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });
    return res
      .status(201)
      .json({ message: "Đăng ký thành công!", accountId: newAccount._id });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi khi đăng ký tài khoản!" });
  }
};

// [POST] /accounts/login
module.exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ message: "Email không hợp lệ" });
    }
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Mật khẩu phải có ít nhất 6 ký tự" });
    }
    const account = await Account.findOne({ email, deleted: false }).populate(
      "roleId"
    );
    if (!account) {
      return res.status(404).json({ message: "Email không tồn tại!" });
    }

    const isPasswordValid = await bcrypt.compare(password, account.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Sai mật khẩu!" });
    }
    if (account.status === "inactive") {
      return res.status(402).json({ message: "Tài khoản đang bị khóa!" });
    }

    // Thêm role name vào token payload
    const tokenUser = generateHelper.generateJWTToken(account, {
      role: account.roleId?.name,
    });
    res.cookie("tokenUser", tokenUser, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    return res.status(200).json({
      message: "Đăng nhập thành công!",
      user: {
        id: account._id,
        email: account.email,
        role: account.roleId.name,
      },
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
      return res.status(404).json({ message: "Email không tồn tại!" });
    }

    const otp = generateHelper.generateRandomNumber(6);
    await ForgotPassword.deleteMany({ email });

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
      return res
        .status(400)
        .json({ message: "OTP không hợp lệ hoặc đã hết hạn!" });
    }

    // Kiểm tra thời gian hết hạn
    if (Date.now() > new Date(result.expireAt).getTime()) {
      await ForgotPassword.deleteOne({ _id: result._id });
      return res.status(400).json({ message: "OTP đã hết hạn!" });
    }

    const account = await Account.findOne({
      email,
      deleted: false,
      status: "active",
    });
    if (!account) {
      return res.status(400).json({ message: "Tài khoản không hợp lệ!" });
    }

    const tokenUser = generateHelper.generateJWTToken(account, {
      purpose: "resetPassword",
    });
    res.cookie("tokenUser", tokenUser, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });
    return res.status(200).json({ message: "Xác thực OTP thành công!" });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi xác thực OTP!" });
  }
};

// [POST] /accounts/password/reset
module.exports.resetPasswordPost = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    const token = req.cookies.tokenUser;
    if (!token)
      return res.status(401).json({ message: "Thiếu token xác thực!" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token đã hết hạn!" });
      }
      return res.status(401).json({ message: "Token không hợp lệ!" });
    }

    // Nếu token dành cho reset password, kiểm tra mục đích
    if (decoded.purpose && decoded.purpose !== "resetPassword") {
      return res
        .status(400)
        .json({ message: "Token không hợp lệ cho hành động này!" });
    }

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Mật khẩu phải ít nhất 6 ký tự!" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await Account.updateOne({ _id: decoded.id }, { password: hashed });

    // Xoá cookie để buộc login lại
    res.clearCookie("tokenUser");

    return res
      .status(200)
      .json({
        message: "Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.",
      });
  } catch (error) {
    return res.status(500).json({ message: "Không thể đặt lại mật khẩu!" });
  }
};

// [GET] /accounts
module.exports.getAccounts = async (req, res) => {
  try {
    let accounts = await Account.find({ deleted: false })
      .populate("roleId", "name")
      .select("-password")
      .lean(); // để dễ xử lý dữ liệu

    // Chuẩn hóa dữ liệu roleId (nếu là mảng thì lấy phần tử đầu)
    accounts = accounts.map((acc) => {
      if (Array.isArray(acc.roleId)) {
        acc.roleId = acc.roleId[0] || null;
      }
      return acc;
    });

    return res.status(200).json({ accounts });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Không thể lấy danh sách tài khoản!" });
  }
};

// [GET] /accounts/{id}
module.exports.getAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    let account = await Account.findOne({ _id: id, deleted: false })
      .populate('roleId', 'name')
      .populate({
        path: 'patient',
        match: { roleId: 'patient' },
      })
      .populate({
        path: 'doctor',
        match: { roleId: 'doctor' },
      })
      .populate({
        path: 'receptionist',
        match: { roleId: 'receptionist' },
      })
      .populate({
        path: 'admin',
        match: { roleId: 'admin' },
      })
      .select('-password')
      .lean();

    if (!account) {
      return res.status(404).json({ message: "Tài khoản không tồn tại!" });
    }

    if (Array.isArray(account.roleId)) {
      account.roleId = account.roleId[0] || null;
    }

    return res.status(200).json({ account });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Không thể lấy thông tin tài khoản!" });
  }
};

// [PUT] /accounts/{id}
module.exports.updateAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, roleId, status } = req.body;
    const updatedAccount = await Account.findOneAndUpdate(
      { _id: id, deleted: false },
      { email, roleId, status },
      { new: true }
    );
    if (!updatedAccount)
      return res.status(404).json({ message: "Tài khoản không tồn tại!" });
    return res
      .status(200)
      .json({
        message: "Cập nhật tài khoản thành công!",
        account: updatedAccount,
      });
  } catch (error) {
    return res.status(500).json({ message: "Không thể cập nhật tài khoản!" });
  }
};
// [DELETE] /accounts/{id}

module.exports.deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;
    //Delete account from database
    const Role = require("../models/role");
    const roleId = (await Account.findById(id).populate("roleId")).roleId._id;
    const roleName = (await Role.findById(roleId)).name;

    if (roleName === "patient") {
      //Delete patient profile if the account is a patient
      await Patient.deleteOne({ accountId: id });
    } else if (roleName === "doctor") {
      //Delete doctor profile if the account is a doctor
      const Doctor = require("../models/doctor");
      await Doctor.deleteOne({ accountId: id });
    } else if (roleName === "receptionist") {
      const Receptionist = require("../models/receptionist");
      await Receptionist.deleteOne({ accountId: id });
    } else if (roleName === "admin") {
      const Admin = require("../models/admin");
      await Admin.deleteOne({ accountId: id });
    }
    const deletedAccount = await Account.findOneAndDelete({ _id: id });
    if (!deletedAccount)
      return res.status(404).json({ message: "Tài khoản không tồn tại!" });
    return res
      .status(200)
      .json({ message: "Xóa tài khoản thành công!", account: deletedAccount });
  } catch (error) {
    return res.status(500).json({ message: "Không thể xóa tài khoản!" });
  }
};

// [GET] /accounts/role/{role_id}
module.exports.getRole = async (req, res) => {
  try {
    const { role_id } = req.params;
    const role = await Role.findById(role_id);
    if (!role)
      return res.status(404).json({ message: "Vai trò không tồn tại!" });
    return res.status(200).json({ role });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Không thể lấy danh sách vai trò!" });
  }
};
