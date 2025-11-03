const express = require("express");
const controller = require("../controllers/patientController");
const router = express.Router();
// Đăng ký bệnh nhân mới
router.post("/register", controller.register);

// Đăng nhập bệnh nhân
router.post("/login", controller.login);

// Đăng xuất bệnh nhân
router.get("/logout", controller.logout);

// Quên mật khẩu - Gửi OTP
router.post("/password/forgot", controller.forgotPasswordPost);

// Xác nhận OTP lấy lại mật khẩu
router.post("/password/otp", controller.otpPasswordPost);

// Đặt lại mật khẩu mới
router.post("/password/reset", controller.resetPasswordPost);

router.get("/:id", controller.getPatientById);

router.get("/", controller.getAllPatients);

router.put("/:id", controller.updatePatient);

router.delete("/:id", controller.deletePatient);

module.exports = router;
