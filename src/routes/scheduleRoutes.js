const express = require('express');
const router = express.Router();
const controller = require('../controllers/scheduleController');

router.get('/:doctor_id', controller.getDoctorScheduleByID);
router.get('/:doctor_id/:date', controller.getDoctorScheduleByDate);
router.get('/specialty/:specialty_id/:date', controller.getAvailableTimeSlotsBySpecialty);
router.post('/', controller.createSchedule);

module.exports = router;