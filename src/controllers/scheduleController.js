const Schedule = require('../models/schedule');

// [GET] /schedules/:doctor_id
module.exports.getDoctorScheduleByID = async (req, res) => {
    try {
        const schedules = await Schedule.find({ doctor_id: req.params.doctor_id });
        if (!schedules.length)
            return res.status(404).json({ message: "No schedules found for this doctor" });
        res.status(200).json(schedules);
    } catch (error) {
        res.status(500).json({ message: "Error fetching schedules", error });
    }
};


// [GET] /schedules/:doctor_id/:date
module.exports.getDoctorScheduleByDate = async (req, res) => {
    try {
        const { doctor_id, date } = req.params;
        const schedule = await Schedule.findOne({ doctor_id, date });

        if (!schedule)
            return res.status(404).json({ message: "No schedule found for this doctor/date" });

        const availableSlots = schedule.timeSlots.filter(slot => !slot.isBooked);
        res.status(200).json(availableSlots);
    } catch (error) {
        res.status(500).json({ message: "Error fetching available slots", error });
    }
};
