const MedicalRecord = require("../models/medicalRecord");
const Treatment = require("../models/treatment");
const Patient = require("../models/patient");

// [POST] /medical-records
module.exports.createMedicalRecord = async (req, res) => {
  try {
    const { patientId, notes } = req.body;

    if (!patientId) {
      return res.status(400).json({ message: "patientId is required" });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    const existingRecord = await MedicalRecord.findOne({ patient: patientId });
    if (existingRecord) {
      return res.status(400).json({ message: "Medical record already exists for this patient" });
    }

    const record = new MedicalRecord({
      patient: patientId,
      notes,
      treatments: []
    });

    await record.save();
    return res.status(201).json({ message: "Medical record created", record });
  } catch (error) {
    console.error("Error creating medical record:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// [GET] /medical-records/:patientId
module.exports.getMedicalRecord = async (req, res) => {
  try {
    const { patientId } = req.params;

    const record = await MedicalRecord.findOne({ patient: patientId })
      .populate({
        path: "treatments",
        populate: [
          { path: "doctor", select: "name specialtyId" },
          { path: "laborder" }, // có thể populate services nếu dùng embedded array
          { path: "prescription" } // populate medicines nếu dùng embedded array
        ]
      });

    if (!record) return res.status(404).json({ message: "Medical record not found" });

    return res.status(200).json({ record });
  } catch (error) {
    console.error("Error getting medical record:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
