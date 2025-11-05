const HealthProfile = require('../models/healthProfile');
const FamilyMember = require('../models/familyMember');
const mongoose = require('mongoose');

function normalizeOwnerModel(raw) {
    if (!raw) return null;
    const v = String(raw).toLowerCase();
    if (v === 'patient') return 'Patient';
    if (v === 'familymember' || v === 'family-member' || v === 'family_member') return 'FamilyMember';
    return null;
}

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

// [POST] /health-profiles/:ownerModel/:ownerId
module.exports.createHealthProfileNew = async (req, res) => {
    try {
        const ownerModel = normalizeOwnerModel(req.params.ownerModel);
        const ownerId = req.params.ownerId;
        if (!ownerModel) return res.status(400).json({ message: 'Invalid ownerModel (expected: patient|familyMember)' });
        if (!mongoose.Types.ObjectId.isValid(ownerId)) return res.status(400).json({ message: 'Invalid ownerId' });

        const exists = await HealthProfile.findOne({ ownerModel, ownerId });
        if (exists) return res.status(400).json({ message: 'Health profile already exists' });

        const { height, weight, bloodType, allergies, chronicConditions, medications, emergencyContact } = req.body;
        if (bloodType && !['A', 'B', 'AB', 'O'].includes(bloodType)) {
            return res.status(400).json({ message: 'Invalid blood type' });
        }

        const profile = new HealthProfile({
            ownerModel,
            ownerId,
            height,
            weight,
            bloodType,
            allergies,
            chronicConditions,
            medications,
            emergencyContact,
        });
        await profile.save();
        return res.status(201).json(profile);
    } catch (error) {
        console.error('Error creating health profile:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// [GET] /health-profiles/all/:patientId
module.exports.getAllHealthProfiles = async (req, res) => {
    try {
        const patientId = req.params.patientId;

        if (!mongoose.Types.ObjectId.isValid(patientId)) {
            return res.status(400).json({ message: "Invalid patientId" });
        }

        // 1️⃣ Lấy danh sách người nhà của bệnh nhân
        const familyMembers = await FamilyMember.find({ bookerId: patientId }).select("_id name relationship phone");

        // 2️⃣ Lấy HealthProfile của chính bệnh nhân
        const patientProfiles = await HealthProfile.find({
            ownerId: patientId,
            ownerModel: "Patient"
        });

        // 3️⃣ Lấy HealthProfile của người nhà
        const familyProfiles = await HealthProfile.find({
            ownerId: { $in: familyMembers.map(fm => fm._id) },
            ownerModel: "FamilyMember"
        });

        // 4️⃣ Gắn thêm thông tin người nhà (nếu cần hiển thị tên, quan hệ,...)
        const familyProfilesWithInfo = familyProfiles.map(fp => {
            const fm = familyMembers.find(m => m._id.equals(fp.ownerId));
            return {
                ...fp.toObject(),
                familyMemberName: fm?.name,
                familyMemberPhone: fm?.phone,
                relationship: fm?.relationship
            };
        });

        // 5️⃣ Gộp lại tất cả hồ sơ
        const allProfiles = [
            ...patientProfiles.map(p => ({ ...p.toObject(), type: "Patient" })),
            ...familyProfilesWithInfo.map(f => ({ ...f, type: "FamilyMember" }))
        ];

        res.status(200).json(allProfiles);
    } catch (error) {
        console.error("Error fetching health profiles:", error);
        res.status(500).json({ message: "Error fetching health profiles", error });
    }
};