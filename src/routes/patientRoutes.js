const express = require("express");
const Patient = require("../models/patient");
const controller = require("../controllers/patientController");
const router = express.Router();

// Đăng ký bệnh nhân mới
router.post("/register", controller.register);

// Đăng nhập bệnh nhân
router.post("/login", controller.login);

// Đăng xuất bệnh nhân
router.get("/logout", controller.logout);

module.exports = router;
