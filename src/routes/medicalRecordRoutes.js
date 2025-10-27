const express = require("express");
const router = express.Router();
const controller = require("../controllers/medicalRecordController");

router.post("/", controller.createMedicalRecord);
router.get("/:patientId", controller.getMedicalRecord);

module.exports = router;
