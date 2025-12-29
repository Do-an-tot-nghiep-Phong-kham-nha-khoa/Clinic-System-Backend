const express = require("express");
const controller = require("../controllers/appointmentController");

const router = express.Router();

// Đặt lịch hẹn
router.post("/by-doctor", controller.createByDoctor);
router.put("/:id/assign-doctor", controller.assignDoctor);
router.put("/:id", controller.updateAppointment);
router.get("/:id", controller.getAppointmentById);
router.get("/booker/:accountId/month", controller.getMonthAppointmentByBooker);
router.get("/booker/:accountId", controller.getAppointmentsByBooker);
router.get("/doctor/:accountId/month", controller.getMonthAppointmentByDoctor);
router.get("/doctor/:accountId/today", controller.getAppointmentsByDoctorToday);
router.get("/doctor/:accountId", controller.getAppointmentsByDoctor);
router.get("/", controller.getAllAppointments);
router.put("/:id/status", controller.updateStatus);
router.post("/by-specialty", controller.createBySpecialty);
router.delete("/:id", controller.deleteAppointment);
router.put("/:id/cancel", controller.cancelAppointment);
router.put("/:id/confirm", controller.confirmAppointment);

module.exports = router;
