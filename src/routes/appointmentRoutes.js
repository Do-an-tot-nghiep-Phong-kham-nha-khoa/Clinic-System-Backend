const express = require("express");
const router = express.Router();
const controller = require("../controllers/appointmentController");

// Đặt lịch hẹn
router.post("/create", controller.create);

module.exports = router;
