const express = require("express");
const appointmentController = require("../controllers/appointmentController");

const router = express.Router();

// Tạo cuộc hẹn mới
router.post("/create", appointmentController.createAppointment);

// Lấy tất cả cuộc hẹn
router.get("/get", appointmentController.getAllAppointments);

// Lấy cuộc hẹn theo ID
router.get("/:id", appointmentController.getAppointmentById);

// Cập nhật cuộc hẹn
router.put("/:id", appointmentController.updateAppointment);

// Hủy cuộc hẹn
router.patch("/:id/cancel", appointmentController.cancelAppointment);

// Lấy cuộc hẹn theo bác sĩ
router.get("/doctor/:doctorId", appointmentController.getAppointmentsByDoctor);

// Lấy cuộc hẹn theo bệnh nhân
router.get("/patient/:patientId", appointmentController.getAppointmentsByPatient);

module.exports = router;
