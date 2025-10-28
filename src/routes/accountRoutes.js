const express = require("express");
const controller = require("../controllers/accountController");
const router = express.Router();
// Đăng ký tài khoản mới
router.post("/register", controller.register);

// Đăng nhập tài khoản
router.post("/login", controller.login);

// Đăng xuất tài khoản
router.get("/logout", controller.logout);

// Quên mật khẩu - Gửi OTP
router.post("/password/forgot", controller.forgotPasswordPost);

// Xác nhận OTP lấy lại mật khẩu
router.post("/password/otp", controller.otpPasswordPost);

// Đặt lại mật khẩu mới
router.post("/password/reset", controller.resetPasswordPost);

module.exports = router;
