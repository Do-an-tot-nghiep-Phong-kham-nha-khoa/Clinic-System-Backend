const express = require('express');
const router = express.Router();
const controller = require('../controllers/scheduleController');

router.get('/:doctor_id', controller.getDoctorScheduleByID);
router.get('/:doctor_id/:date', controller.getDoctorScheduleByDate);

module.exports = router;