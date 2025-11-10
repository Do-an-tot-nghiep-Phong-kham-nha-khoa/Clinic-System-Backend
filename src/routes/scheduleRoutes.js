const express = require('express');
const router = express.Router();
const controller = require('../controllers/scheduleController');

router.get('/specialty/:specialty_id/:date', controller.getAvailableTimeSlotsBySpecialty);

router.get('/:doctor_id', controller.getDoctorScheduleByID);
router.get('/:doctor_id/:date', controller.getDoctorScheduleByDate);

router.post('/', controller.createSchedule);

module.exports = router;
