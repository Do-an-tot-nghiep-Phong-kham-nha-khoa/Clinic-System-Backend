const FamilyMember = require("../models/familyMember");
const mongoose = require("mongoose");

// [POST] /family-members
module.exports.createFamilyMember = async (req, res) => {
    try {
        const { bookerId, name, relationship, dob, gender, phone } = req.body;

        // validate bookerId (Patient ID)
        if (!mongoose.Types.ObjectId.isValid(bookerId)) {
            return res.status(400).json({ message: "Invalid bookerId" });
        }

        const familyMember = new FamilyMember({
            bookerId,
            name,
            relationship,
            dob,
            gender,
            phone
        });
        await familyMember.save();
        res.status(201).json(familyMember);
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error", error });
    }
};