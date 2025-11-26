const express = require("express");
const controller = require("../controllers/accountController");
const { route } = require("./patientRoutes");
const accountValidate = require("../validates/accountValidate");
const router = express.Router();
// Đăng ký tài khoản mới
router.post("/register", accountValidate.register, controller.register);

// Đăng nhập tài khoản
router.post("/login", accountValidate.login, controller.login);

// Đăng xuất tài khoản
router.get("/logout", controller.logout);

// Quên mật khẩu - Gửi OTP
router.post("/password/forgot", accountValidate.forgotPassword, controller.forgotPasswordPost);

// Xác nhận OTP lấy lại mật khẩu
router.post("/password/otp", controller.otpPasswordPost);

// Đặt lại mật khẩu mới
router.post("/password/reset", accountValidate.resetPassword, controller.resetPasswordPost);

// Lấy danh sách tài khoản
router.get("/", controller.getAccounts);

router.get("/:id", controller.getAccountById);

router.delete("/:id", controller.deleteAccount);

router.put("/:id", controller.updateAccount);
// Lấy danh sách vai trò
router.get("/role/:role_id", controller.getRole);
module.exports = router;
