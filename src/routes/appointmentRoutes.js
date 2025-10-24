const express = require("express");
const appointmentController = require("../controllers/appointmentController");

const router = express.Router();

// Đặt lịch hẹn
router.post("/", controller.create);
router.put("/:id/assign-doctor", controller.assignDoctor);
router.get("/:id", controller.getAppointmentById);
router.get("/booker/:id", controller.getAppointmentsByBooker);
router.get("/doctor/:id", controller.getAppointmentsByDoctor);
router.get("/", controller.getAllAppointments);
router.put("/:id/status", controller.updateStatus);
module.exports = router;
