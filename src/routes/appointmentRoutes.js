const express = require("express");
const router = express.Router();
const controller = require("../controllers/appointmentController");

// Đặt lịch hẹn
router.post("/", controller.createAppointment);

// Lấy danh sách lịch hẹn của bệnh nhân
router.get("/patient/:patientId", controller.getAppointmentsByPatient);

// Hủy lịch hẹn
router.delete("/:id", controller.cancelAppointment);

module.exports = router;
