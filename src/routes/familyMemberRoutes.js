const express = require('express');
const controller = require('../controllers/familyMemberController');
const router = express.Router();

router.post('/', controller.createFamilyMember);

// Lấy danh sách theo patient
router.get('/:patientId', controller.getFamilyMembersByPatient);

// Cập nhật FamilyMember
router.patch('/:id', controller.updateFamilyMember);
router.delete('/:id', controller.deleteFamilyMember);

module.exports = router;