const express = require("express");
const controller = require("../controllers/appointmentController");

const router = express.Router();

// Đặt lịch hẹn
router.post("/by-doctor", controller.createByDoctor);
router.put("/:id/assign-doctor", controller.assignDoctor);
router.put("/:id", controller.updateAppointment);
router.get("/:id", controller.getAppointmentById);
router.get("/booker/:id", controller.getAppointmentsByBooker);
router.get("/doctor/:id/today", controller.getAppointmentsByDoctorToday);
router.get("/doctor/:id", controller.getAppointmentsByDoctor);
router.get("/", controller.getAllAppointments);
router.put("/:id/status", controller.updateStatus);
router.post("/by-specialty", controller.createBySpecialty);
router.delete("/:id", controller.deleteAppointment);
router.put("/:id/cancel", controller.cancelAppointment);

module.exports = router;
