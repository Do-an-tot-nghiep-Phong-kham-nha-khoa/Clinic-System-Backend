const express = require('express');
const controller = require('../controllers/healthProfileController');
const router = express.Router();

router.get('/:patientId', controller.getHealthProfile);
router.post('/:patientId', controller.createHealthProfile);
router.patch('/:patientId', controller.updateHealthProfile);

module.exports = router;