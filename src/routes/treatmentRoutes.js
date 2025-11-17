const express = require("express");
const treatmentController = require("../controllers/treatmentController");

const router = express.Router();

// Tạo hồ sơ điều trị mới
router.post("/", treatmentController.createTreatment);

// Lấy tất cả hồ sơ điều trị
router.get("/", treatmentController.getAllTreatments);

// Lấy hồ sơ điều trị theo ID
router.get("/:id", treatmentController.getTreatmentById);

// Cập nhật hồ sơ điều trị
router.put("/:id", treatmentController.updateTreatment);

// Xóa hồ sơ điều trị
router.delete("/:id", treatmentController.deleteTreatment);

// Lấy hồ sơ điều trị theo bệnh nhân
router.get("/patient/:patientId", treatmentController.getTreatmentsByPatient);

// Lấy hồ sơ điều trị theo bác sĩ
router.get("/doctor/:doctorId", treatmentController.getTreatmentsByDoctor);

// Lấy thống kê điều trị
router.get("/stats/overview", treatmentController.getTreatmentStats);

router.get("/booker/:id", treatmentController.getTreatmentsByBooker);

module.exports = router;