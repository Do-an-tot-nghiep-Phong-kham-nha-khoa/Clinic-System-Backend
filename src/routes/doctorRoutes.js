const express = require("express");
const doctorController = require("../controllers/doctorController");
const uploadMemory = require("../middlewares/uploadMemory");
const router = express.Router();
// Tạo bác sĩ mới
router.post("/", uploadMemory.single('avatar'), doctorController.createDoctor);

// Lấy danh sách tất cả bác sĩ
router.get("/", doctorController.getAllDoctors);

// Lấy thông tin bác sĩ theo ID
router.get("/:id", doctorController.getDoctorById);

// Cập nhật thông tin bác sĩ
router.put("/:id", doctorController.updateDoctor);

// Xóa bác sĩ

router.post("/batch", doctorController.getDoctorsByIds);

router.delete("/:id", doctorController.deleteDoctor);

// Tìm kiếm bác sĩ
router.get("/search", doctorController.searchDoctors);

// Lấy bác sĩ theo chuyên khoa
router.get("/specialty/:specialtyId", doctorController.getDoctorsBySpecialty);

// Lấy bác sĩ theo account id
router.get("/account/:accountId", doctorController.getDoctorByAccountId);

// Cập nhật bio bác sĩ
router.patch("/:id/bio", doctorController.updateDoctorBio);

module.exports = router;
