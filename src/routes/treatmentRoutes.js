const express = require("express");
const treatmentController = require("../controllers/treatmentController");

const router = express.Router();

// Tạo hồ sơ điều trị mới
router.post("/", treatmentController.createTreatment);
router.get("/booker/:accountId", treatmentController.getTreatmentByBooker);

// Lấy hồ sơ điều trị theo ID
router.get("/:id", treatmentController.getTreatmentById);

module.exports = router;
