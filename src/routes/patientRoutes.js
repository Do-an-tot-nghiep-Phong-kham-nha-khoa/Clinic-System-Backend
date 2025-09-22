const express = require("express");
const Patient = require("../models/patient");

const router = express.Router();

// Đăng ký bệnh nhân mới
router.post("/create", async (req, res) => {
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
router.get("/get", async (req, res) => {
  try {
    console.log("Fetching patients...");
    const patients = await Patient.find();
    console.log("Patients found:", patients);
    res.json(patients);
  } catch (err) {
    console.error("Error fetching patients:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
