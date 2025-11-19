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
        const shift = req.query.shift;

        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        const schedules = await Schedule.find({
            doctor_id,
            date: { $gte: startDate, $lte: endDate }
        });

        if (!schedules.length)
            return res.status(404).json({ message: "No schedule found for this doctor/date" });

        let availableSlots = [];

        schedules.forEach(sch => {
            sch.timeSlots.forEach(slot => {
                if (!slot.isBooked) {
                    availableSlots.push({
                        startTime: slot.startTime,
                        endTime: slot.endTime
                    });
                }
            });
        });

        // filter theo shift
        if (shift) {
            const isMorning = time => Number(time.split(':')[0]) < 12;
            if (shift === 'morning') availableSlots = availableSlots.filter(s => isMorning(s.startTime));
            if (shift === 'afternoon') availableSlots = availableSlots.filter(s => !isMorning(s.startTime));
        }

        // sort theo startTime
        availableSlots.sort((a, b) => Number(a.startTime.replace(':', '')) - Number(b.startTime.replace(':', '')));

        res.status(200).json(availableSlots);

    } catch (error) {
        console.error("Error fetching available slots:", error);
        res.status(500).json({ message: "Error fetching available slots", error });
    }
};

// [GET] /schedules/specialty/:specialty_id/:date
module.exports.getAvailableTimeSlotsBySpecialty = async (req, res) => {
    try {
        const { specialty_id, date } = req.params;
        // console.log('Fetching available slots for specialty:', specialty_id, 'on date:', date);
        // Step 1: find all doctors of this specialty
        const doctors = await Doctor.find({ specialtyId: specialty_id });
        // console.log('Found doctors:', doctors);
        if (doctors.length === 0) {
            return res.status(404).json({ message: "No doctors found for this specialty" });
        }

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

// [PUT] /schedules/slot/:slotId
module.exports.updateDoctorScheduleSlot = async (req, res) => {
    try {
        const { slotId } = req.params;
        const { isBooked } = req.body;

        // Validate required fields
        if (typeof isBooked !== 'boolean') {
            return res.status(400).json({
                message: 'isBooked field is required and must be a boolean'
            });
        }

        // Find the schedule that contains this slot
        const schedule = await Schedule.findOne({
            'timeSlots._id': slotId
        });

        if (!schedule) {
            return res.status(404).json({
                message: 'Time slot not found'
            });
        }

        // Find and update the specific slot
        const slot = schedule.timeSlots.id(slotId);
        if (!slot) {
            return res.status(404).json({
                message: 'Time slot not found in schedule'
            });
        }

        slot.isBooked = isBooked;
        await schedule.save();

        return res.status(200).json({
            message: 'Time slot updated successfully',
            slot: {
                _id: slot._id,
                startTime: slot.startTime,
                endTime: slot.endTime,
                isBooked: slot.isBooked
            }
        });

    } catch (error) {
        console.error('Error updating time slot:', error);
        return res.status(500).json({
            message: 'Error updating time slot',
            error: error.message
        });
    }
};

// [PUT] /schedules/:scheduleId
module.exports.updateDoctorSchedule = async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const { date, timeSlots } = req.body;

        // Validate scheduleId
        if (!scheduleId) {
            return res.status(400).json({ message: 'Schedule ID is required' });
        }

        // Find the schedule
        const schedule = await Schedule.findById(scheduleId);
        if (!schedule) {
            return res.status(404).json({ message: 'Schedule not found' });
        }

        // Prepare update object
        const updates = {};
        if (date) updates.date = new Date(date);
        if (timeSlots && Array.isArray(timeSlots)) {
            // Validate timeSlots structure
            for (const slot of timeSlots) {
                if (!slot.startTime || !slot.endTime) {
                    return res.status(400).json({
                        message: 'Each time slot must have startTime and endTime'
                    });
                }
            }
            updates.timeSlots = timeSlots;
        }

        // Check if there are any updates
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }

        // Apply updates
        Object.assign(schedule, updates);
        await schedule.save();

        return res.status(200).json({
            message: 'Schedule updated successfully',
            schedule
        });

    } catch (error) {
        console.error('Error updating schedule:', error);
        return res.status(500).json({
            message: 'Error updating schedule',
            error: error.message
        });
    }
};

// [DELETE] /schedules/:scheduleId
module.exports.deleteDoctorSchedule = async (req, res) => {
    try {
        const { scheduleId } = req.params;

        // Validate scheduleId
        if (!scheduleId) {
            return res.status(400).json({ message: 'Schedule ID is required' });
        }

        // Find and delete the schedule
        const schedule = await Schedule.findByIdAndDelete(scheduleId);

        if (!schedule) {
            return res.status(404).json({ message: 'Schedule not found' });
        }

        return res.status(200).json({
            message: 'Schedule deleted successfully',
            deletedSchedule: {
                _id: schedule._id,
                doctor_id: schedule.doctor_id,
                date: schedule.date
            }
        });

    } catch (error) {
        console.error('Error deleting schedule:', error);
        return res.status(500).json({
            message: 'Error deleting schedule',
            error: error.message
        });
    }
};