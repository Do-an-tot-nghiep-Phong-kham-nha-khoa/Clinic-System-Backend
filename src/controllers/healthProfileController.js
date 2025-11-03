const HealthProfile = require('../models/healthProfile');
// [GET] /health-profile/:patientId
module.exports.getHealthProfile = async (req, res) => {
    try {
        const profiles = await HealthProfile.find({
            ownerId: req.params.patient_id
        });
        if (!profiles.length)
            return res.status(404).json({ message: "No health profiles found" });
        
        res.status(200).json(profiles);
    } catch (error) {
        res.status(500).json({ message: "Error fetching health profiles", error });
    }
};

// [POST] /health-profile/:patientId
module.exports.createHealthProfile = async (req, res) => {
    try {
        const { patientId } = req.params;
        const { height, weight, bloodType, allergies, chronicConditions, medications, emergencyContact } = req.body;

        const existingProfile = await HealthProfile.findOne({ patient_id: patientId });
        if (existingProfile) {
            return res.status(400).json({ message: "Health profile already exists" });
        }
        const healthProfile = new HealthProfile({
            patient_id: patientId,
            height,
            weight,
            bloodType,
            allergies,
            chronicConditions,
            medications,
            emergencyContact
        });

        await healthProfile.save();
        return res.status(201).json(healthProfile);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

// [PATCH] /health-profile/:patientId
module.exports.updateHealthProfile = async (req, res) => {
    try {
        const { patientId } = req.params;
        const updates = req.body;
        const healthProfile = await HealthProfile.findOneAndUpdate(
            { patient_id: patientId },
            { ...updates, lastUpdated: Date.now() },
            { new: true }
        );
        if (!healthProfile) {
            return res.status(404).json({ message: "Health profile not found" });
        }
        res.json(healthProfile);
    } catch (error) {
        console.error("Error updating health profile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};