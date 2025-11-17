const FamilyMember = require('../models/familyMember');
const mongoose = require('mongoose');

/**
 * Tạo FamilyMember mới
 * POST /family-members
 * Body: { bookerId, name, relationship, dob?, phone? }
 */
module.exports.createFamilyMember = async (req, res) => {
    try {
        const { bookerId, name, relationship, dob, phone } = req.body;

        if (!mongoose.Types.ObjectId.isValid(bookerId)) {
            return res.status(400).json({ message: "Invalid bookerId" });
        }
        if (!name || !relationship) {
            return res.status(400).json({ message: "Name and relationship are required" });
        }

        const familyMember = new FamilyMember({
            bookerId,
            name,
            relationship,
            dob: dob ? new Date(dob) : undefined,
            phone
        });

        await familyMember.save();
        return res.status(201).json(familyMember);
    } catch (error) {
        console.error('Error creating family member:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Lấy danh sách FamilyMember của 1 patient
 * GET /family-members/by-patient/:patientId
 */
module.exports.getFamilyMembersByPatient = async (req, res) => {
    try {
        const { patientId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(patientId)) {
            return res.status(400).json({ message: "Invalid patientId" });
        }

        const familyMembers = await FamilyMember.find({ bookerId: patientId });
        return res.status(200).json(familyMembers);
    } catch (error) {
        console.error('Error fetching family members:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Cập nhật FamilyMember
 * PATCH /family-members/:id
 */
module.exports.updateFamilyMember = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid id" });
        }

        const updated = await FamilyMember.findByIdAndUpdate(id, updates, { new: true });
        if (!updated) return res.status(404).json({ message: 'FamilyMember not found' });

        return res.status(200).json(updated);
    } catch (error) {
        console.error('Error updating family member:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// [DELETE] /family-members/:id
module.exports.deleteFamilyMember = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid id" });
        }
        const deleted = await FamilyMember.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ message: 'FamilyMember not found' });
        return res.status(200).json({ message: 'FamilyMember deleted successfully' });
    } catch (error) {
        console.error('Error deleting family member:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};