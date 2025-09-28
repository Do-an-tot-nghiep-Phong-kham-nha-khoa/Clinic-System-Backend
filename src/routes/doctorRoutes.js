const express = require("express");
const doctorController = require("../controllers/doctorController");

const router = express.Router();

// Tạo bác sĩ mới
router.post("/create", doctorController.createDoctor);

// Lấy danh sách tất cả bác sĩ
router.get("/get", doctorController.getAllDoctors);

// Lấy thông tin bác sĩ theo ID
router.get("/:id", doctorController.getDoctorById);

// Cập nhật thông tin bác sĩ
router.put("/:id", doctorController.updateDoctor);

// Xóa bác sĩ
router.delete("/:id", doctorController.deleteDoctor);

// Tìm kiếm bác sĩ
router.get("/search/query", doctorController.searchDoctors);

// Lấy bác sĩ theo chuyên khoa
router.get("/expertise/:expertise", doctorController.getDoctorsByExpertise);

module.exports = router;
