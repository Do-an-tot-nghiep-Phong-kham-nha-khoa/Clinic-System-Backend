const express = require('express');
const controller = require('../controllers/familyMemberController');
const router = express.Router();

router.post('/', controller.createFamilyMember);

module.exports = router;