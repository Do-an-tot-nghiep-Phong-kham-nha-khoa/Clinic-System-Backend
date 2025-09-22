const express = require("express");
const Patient = require("../models/patient");

const router = express.Router();

// Đăng ký bệnh nhân mới
router.post("/", async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    const patient = new Patient({ name, phone, email });
    const saved = await patient.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Lấy danh sách bệnh nhân
router.get("/", async (req, res) => {
  try {
    const patients = await Patient.find();
    res.json(patients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
