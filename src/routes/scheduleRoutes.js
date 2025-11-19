const express = require('express');
const router = express.Router();
const controller = require('../controllers/scheduleController');

router.get('/specialty/:specialty_id/:date', controller.getAvailableTimeSlotsBySpecialty);

router.get('/:doctor_id/:date', controller.getDoctorScheduleByDate);
router.get('/:doctor_id', controller.getDoctorScheduleByID);

router.post('/', controller.createSchedule);

// Update isBooked for a specific time slot by slotId
router.put('/slot/:slotId', controller.updateDoctorScheduleSlot);

// Update entire schedule (date and/or timeSlots)
router.put('/:scheduleId', controller.updateDoctorSchedule);

// Delete schedule
router.delete('/:scheduleId', controller.deleteDoctorSchedule);

module.exports = router;
