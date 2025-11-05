const HealthProfile = require('../models/healthProfile');

// [GET] /health-profile/:ownerId
module.exports.getHealthProfile = async (req, res) => {
    try {
        const { ownerId } = req.params;
        const { ownerModel } = req.query; // truyền kèm qua query, ví dụ: ?ownerModel=Patient

        if (!ownerModel) {
            return res.status(400).json({ message: "Thiếu tham số ownerModel (Patient hoặc FamilyMember)" });
        }

        const profile = await HealthProfile.findOne({
            ownerId,
            ownerModel
        });

        if (!profile)
            return res.status(404).json({ message: "Không tìm thấy hồ sơ sức khỏe" });

        res.status(200).json(profile);
    } catch (error) {
        console.error("Error fetching health profile:", error);
        res.status(500).json({ message: "Lỗi khi lấy hồ sơ sức khỏe", error });
    }
};

// [POST] /health-profile/:ownerId?ownerModel=Patient
module.exports.createHealthProfile = async (req, res) => {
    try {
        const { ownerId } = req.params;
        const { ownerModel } = req.query; // ví dụ: Patient hoặc FamilyMember
        const {
            height,
            weight,
            bloodType,
            allergies,
            chronicConditions,
            medications,
            emergencyContact
        } = req.body;

        if (!ownerModel) {
            return res.status(400).json({ message: "Thiếu tham số ownerModel (Patient hoặc FamilyMember)" });
        }

        const existingProfile = await HealthProfile.findOne({ ownerId, ownerModel });
        if (existingProfile) {
            return res.status(400).json({ message: "Hồ sơ sức khỏe đã tồn tại" });
        }

        const newProfile = new HealthProfile({
            ownerId,
            ownerModel,
            height,
            weight,
            bloodType,
            allergies,
            chronicConditions,
            medications,
            emergencyContact
        });

        await newProfile.save();
        return res.status(201).json({
            message: "Tạo hồ sơ sức khỏe thành công",
            profile: newProfile
        });
    } catch (error) {
        console.error("Error creating health profile:", error);
        res.status(500).json({ message: "Lỗi khi tạo hồ sơ sức khỏe", error });
    }
};

// [PATCH] /health-profile/:ownerId?ownerModel=Patient
module.exports.updateHealthProfile = async (req, res) => {
    try {
        const { ownerId } = req.params;
        const { ownerModel } = req.query;
        const updates = req.body;

        if (!ownerModel) {
            return res.status(400).json({ message: "Thiếu tham số ownerModel (Patient hoặc FamilyMember)" });
        }

        const updatedProfile = await HealthProfile.findOneAndUpdate(
            { ownerId, ownerModel },
            { ...updates, lastUpdated: Date.now() },
            { new: true }
        );

        if (!updatedProfile) {
            return res.status(404).json({ message: "Không tìm thấy hồ sơ sức khỏe để cập nhật" });
        }

        res.status(200).json({
            message: "Cập nhật hồ sơ sức khỏe thành công",
            profile: updatedProfile
        });
    } catch (error) {
        console.error("Error updating health profile:", error);
        res.status(500).json({ message: "Lỗi khi cập nhật hồ sơ sức khỏe", error });
    }
};
