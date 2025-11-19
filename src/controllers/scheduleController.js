const Schedule = require('../models/schedule');
const Doctor = require('../models/doctor');

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

// [GET] /schedules/specialty/:specialty_id/:date
module.exports.getAvailableTimeSlotsBySpecialty = async (req, res) => {
    try {
        const { specialty_id, date } = req.params;
        // Step 1: find all doctors of this specialty
        const doctors = await Doctor.find({ specialtyId: specialty_id });
        // console.log('Found doctors:', doctors);
        if (doctors.length === 0) {
            return res.status(404).json({ message: "No doctors found for this specialty" });
        }

        // Create a map for doctor names
        const doctorMap = new Map(doctors.map(d => [d._id.toString(), d.name]));

        const doctorIds = doctors.map(d => d._id);

        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        // Step 2: find all schedules of these doctors at that date
        const schedules = await Schedule.find({
            doctor_id: { $in: doctorIds },
            date: { $gte: startDate, $lte: endDate }
        });

        if (schedules.length === 0) {
            return res.status(404).json({ message: "No schedule found for this specialty/date" });
        }

        let result = [];

        schedules.forEach(sch => {
            sch.timeSlots.forEach(slot => {
                if (!slot.isBooked) {
                    result.push({
                        doctor_id: sch.doctor_id,
                        startTime: slot.startTime,
                        endTime: slot.endTime
                    })
                }
            })
        });

        const merged = {};

        // merge slots with same time range
        result.forEach(r => {
            const key = r.startTime + "-" + r.endTime;
            if (!merged[key]) {
                merged[key] = {
                    startTime: r.startTime,
                    endTime: r.endTime,
                    doctor_ids: []
                }
            }
            merged[key].doctor_ids.push(r.doctor_id.toString());
        });

        // Optional: sort theo startTime
        const sorted = Object.values(merged).sort((a, b) => {
            return Number(a.startTime.replace(':', '')) - Number(b.startTime.replace(':', ''));
        });

        const shift = req.query.shift;
        // morning: < 12:00, afternoon >= 12:00

        const isMorning = (time) => Number(time.split(':')[0]) < 12;

        let final = sorted;

        if (shift === 'morning') {
            final = sorted.filter(r => isMorning(r.startTime));
        }
        if (shift === 'afternoon') {
            final = sorted.filter(r => !isMorning(r.startTime));
        }

        // Add doctor_names to each slot
        final.forEach(slot => {
            slot.doctor_names = slot.doctor_ids.map(id => doctorMap.get(id) || 'Unknown');
        });

        return res.status(200).json(final);

    } catch (error) {
        console.error("Error fetching available slots:", error);
        return res.status(500).json({ message: "Error fetching available slots", error });
    }
};

// [POST] /schedules
module.exports.createSchedule = async (req, res) => {
    try {
        const { doctor_id, date, timeSlots } = req.body;

        if (!doctor_id || !date || !timeSlots || !Array.isArray(timeSlots)) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // prevent duplicate schedule for same doctor/date
        const existed = await Schedule.findOne({ doctor_id, date });
        if (existed) {
            return res.status(409).json({
                message: "Schedule already exists for this doctor and date"
            });
        }

        const schedule = await Schedule.create({
            doctor_id,
            date: new Date(date),
            timeSlots
        });

        return res.status(201).json({
            message: "Schedule created successfully",
            schedule
        });

    } catch (error) {
        return res.status(500).json({ message: "Error creating schedule", error });
    }
};