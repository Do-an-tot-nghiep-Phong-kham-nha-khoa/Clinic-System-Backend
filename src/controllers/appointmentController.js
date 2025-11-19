const Appointment = require('../models/appointment');
const Patient = require('../models/patient');
const Doctor = require('../models/doctor');
const Schedule = require('../models/schedule');
const Specialty = require('../models/specialty');
const HealthProfile = require('../models/healthProfile');
const FamilyMember = require('../models/familyMember');

// [POST] /appointments/by-doctor
module.exports.createByDoctor = async (req, res) => {
  try {
    const { booker_id, healthProfile_id, doctor_id, specialty_id, appointmentDate, timeSlot, reason } = req.body;

    // ==== 1. Validate cơ bản ====
    if (!booker_id || !healthProfile_id || !appointmentDate || !timeSlot || !reason) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // ==== 2. Kiểm tra bệnh nhân ====
    const booker = await Patient.findById(booker_id);
    if (!booker) return res.status(404).json({ message: 'Profile not found or not owned by booker' });

    // ==== 3. Kiểm tra health profile ====
    const profile = await HealthProfile.findById(healthProfile_id);
    if (!profile) {
      return res.status(404).json({ message: 'Health profile not found' });
    }

    // ==== 4. Đặt theo bác sĩ ====
    let doctor, specialty;
    if (doctor_id && !specialty_id) {
      doctor = await Doctor.findById(doctor_id);
      if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

      // Lấy specialty từ bác sĩ
      specialty = doctor.specialtyId;
      // Tìm schedule của bác sĩ cho ngày đó

      const dateOnly = new Date(appointmentDate);

      const startOfDay = new Date(dateOnly);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(dateOnly);
      endOfDay.setHours(23, 59, 59, 999);

      const schedule = await Schedule.findOne({
        doctor_id,
        date: { $gte: startOfDay, $lte: endOfDay },
      });

      if (!schedule) {
        return res.status(400).json({ message: 'Doctor has no schedule for this date' });
      }

      // Tìm slot
      const normalize = (t) => t.split(" ")[0].split("-")[0].trim().slice(0, 5); // lấy "HH:MM"
      const normalizedInput = normalize(timeSlot);

      const slot = schedule.timeSlots.find(
        (s) => normalize(s.startTime) === normalizedInput
      );
      if (!slot)
        return res.status(400).json({ message: "Invalid time slot" });

      if (slot.isBooked)
        return res.status(400).json({ message: "Time slot already booked" });

      // Tạo appointment
      const newAppointment = new Appointment({
        booker_id,
        healthProfile_id,
        doctor_id: doctor._id,
        specialty_id: specialty,
        appointmentDate,
        timeSlot,
        reason,
        status: "pending"
      });

      await newAppointment.save();

      // Cập nhật schedule: tìm bằng khoảng ngày giống lúc lấy schedule và match startTime (không match cả chuỗi timeSlot)
      const updateResult = await Schedule.findOneAndUpdate(
        { doctor_id, date: { $gte: startOfDay, $lte: endOfDay }, "timeSlots.startTime": slot.startTime },
        { $set: { "timeSlots.$.isBooked": true, "timeSlots.$.appointment_id": newAppointment._id } },
        { new: true }
      );

      // Nếu không update được bằng startTime chính xác, thử match bằng phần bắt đầu của timeSlot (normalize)
      if (!updateResult) {
        const fallback = await Schedule.findOneAndUpdate(
          { doctor_id, date: { $gte: startOfDay, $lte: endOfDay }, "timeSlots.startTime": { $regex: `^${normalizedInput}` } },
          { $set: { "timeSlots.$.isBooked": true, "timeSlots.$.appointment_id": newAppointment._id } },
          { new: true }
        );
        console.log('Schedule update fallback result:', !!fallback);
      } else {
        console.log('Schedule updated for appointment slot:', slot.startTime);
      }

      return res.status(201).json({
        message: 'Appointment booked successfully with doctor',
        appointment: newAppointment,
      });
    }

  } catch (error) {
    console.error('Error creating appointment:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// [PUT] /appointments/:id/assign-doctor
module.exports.assignDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { doctor_id } = req.body;
    if (!doctor_id) {
      return res.status(400).json({ message: 'doctor_id is required' });
    }
    // ==== 1. Lấy appointment ====
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    // ==== 2. Chỉ cho phép phân công nếu đang waiting_assigned ====
    if (appointment.status !== 'waiting_assigned') {
      return res.status(400).json({ message: 'Only appointments with status "waiting_assigned" can be assigned' });
    }
    // ==== 3. Kiểm tra bác sĩ ====
    const doctor = await Doctor.findById(doctor_id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    // console.log(doctor.specialtyId, appointment.specialty_id);
    // Bác sĩ phải cùng chuyên khoa với lịch hẹn
    if (doctor.specialtyId.toString() !== appointment.specialty_id.toString()) {
      return res.status(400).json({ message: 'Doctor specialty does not match appointment specialty' });
    } else console.log('Specialty match');

    // ==== 4. Tìm schedule của bác sĩ cho ngày đó ====
    const dateOnly = new Date(appointment.appointmentDate);
    dateOnly.setHours(0, 0, 0, 0);

    const nextDay = new Date(dateOnly);
    nextDay.setDate(nextDay.getDate() + 1);

    const schedule = await Schedule.findOne({
      doctor_id: doctor._id,
      date: { $gte: dateOnly, $lt: nextDay },
    });
    // console.log('Found schedule:', schedule);
    if (!schedule) {
      return res.status(400).json({ message: 'Doctor has no schedule for this date' });
    }
    const normalize = t => t.split(" ")[0].split("-")[0].trim().slice(0, 5);
    const normalizedAppointmentSlot = normalize(appointment.timeSlot);

    // ==== 5. Kiểm tra slot có trống không ====
    const slotIndex = schedule.timeSlots.findIndex(
      slot => normalize(slot.startTime) === normalizedAppointmentSlot
    );
    // console.log('Slot index:', slotIndex);
    console.log(schedule.timeSlots[slotIndex + 1]);
    if (schedule.timeSlots[slotIndex + 1].isBooked) {
      return res.status(400).json({ message: 'This time slot is already booked by another patient' });
    }

    // ==== 6. Cập nhật dữ liệu ====
    appointment.doctor_id = doctor._id;
    appointment.status = 'pending';
    await appointment.save();

    schedule.timeSlots[slotIndex].isBooked = true;
    schedule.timeSlots[slotIndex].appointment_id = appointment._id;
    await schedule.save();

    return res.status(200).json({
      message: 'Doctor assigned successfully to appointment',
      appointment,
    });
  } catch (error) {
    console.error('Error assigning doctor:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


// [PUT] /appointments/:id/status
module.exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ message: 'Invalid status value' });

    const appointment = await Appointment.findByIdAndUpdate(id, { status }, { new: true });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    res.status(200).json({ message: 'Appointment status updated', appointment });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// [GET] /appointments
module.exports.getAllAppointments = async (req, res) => {
  try {
    const { doctor_id, booker_id, status, date, specialty_id } = req.query;

    const filter = {};
    if (doctor_id) filter.doctor_id = doctor_id;
    if (booker_id) filter.booker_id = booker_id;
    if (specialty_id) filter.specialty_id = specialty_id;
    if (status) filter.status = status;
    if (date) filter.appointmentDate = new Date(date);

    const appointments = await Appointment.find(filter)
      .populate('doctor_id specialty_id booker_id')
      .sort({ appointmentDate: 1 });

    res.status(200).json({ count: appointments.length, appointments });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// [GET] /appointments/doctor/:id
module.exports.getAppointmentsByDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, status } = req.query;

    const filter = { doctor_id: id };
    if (date) filter.appointmentDate = new Date(date);
    if (status) filter.status = status;

    let appointments = await Appointment.find(filter)
      .populate('healthProfile_id')
      .sort({ appointmentDate: 1 });

    if (!appointments.length)
      return res.status(404).json({ message: 'No appointments found for this doctor' });

    // append owner info (Patient or FamilyMember)
    const final = await Promise.all(
      appointments.map(async (app) => {
        const hp = app.healthProfile_id;

        if (!hp || !hp.ownerId || !hp.ownerModel) return app;

        let owner;
        if (hp.ownerModel === "Patient") {
          owner = await Patient.findById(hp.ownerId)
            .select("name dob phone gender");
        } else if (hp.ownerModel === "FamilyMember") {
          owner = await FamilyMember.findById(hp.ownerId)
            .select("name dob phone gender");
        }

        return {
          ...app.toObject(),
          healthProfile_id: {
            ...hp.toObject(),
            owner_detail: owner || null
          }
        };
      })
    );

    res.status(200).json({ count: final.length, appointments: final });

  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// [GET] /appointments/booker/:id
module.exports.getAppointmentsByBooker = async (req, res) => {
  try {
    const { id } = req.params; // booker_id
    const { date, status } = req.query;

    const filter = { booker_id: id };
    if (date) filter.appointmentDate = new Date(date);
    if (status) filter.status = status;

    let appointments = await Appointment.find(filter)
      .populate('doctor_id specialty_id healthProfile_id')
      .sort({ appointmentDate: -1 });

    if (!appointments.length)
      return res.status(404).json({ message: 'No appointments found for this patient' });

    const final = await Promise.all(
      appointments.map(async (app) => {
        const hp = app.healthProfile_id;

        if (!hp || !hp.ownerId || !hp.ownerModel) {
          return app.toObject();
        }

        let owner;
        if (hp.ownerModel === "Patient") {
          owner = await Patient.findById(hp.ownerId)
            .select("name dob phone gender");
        } else if (hp.ownerModel === "FamilyMember") {
          owner = await FamilyMember.findById(hp.ownerId)
            .select("name dob phone gender");
        }

        return {
          ...app.toObject(),
          healthProfile_id: {
            ...hp.toObject(),
            owner_detail: owner || null
          }
        };
      })
    );

    res.status(200).json({ count: final.length, appointments: final });
  } catch (error) {
    console.error('Error fetching patient appointments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// [GET] /appointments/:id
module.exports.getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('doctor_id specialty_id booker_id');

    if (!appointment)
      return res.status(404).json({ message: 'Appointment not found' });

    res.status(200).json(appointment);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// [POST] /appointments/by-specialty
module.exports.createBySpecialty = async (req, res) => {
  try {
    const { booker_id, healthProfile_id, specialty_id, appointmentDate, timeSlot, reason } = req.body;

    // 1. Validate
    if (!booker_id || !healthProfile_id || !specialty_id || !appointmentDate || !timeSlot || !reason) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // 2. Kiểm tra bệnh nhân có tồn tại
    const booker = await Patient.findById(booker_id);
    if (!booker) {
      return res.status(404).json({ message: 'Booker not found' });
    }

    // 3. Kiểm tra health profile thuộc về bệnh nhân này
    const profile = await HealthProfile.findById(healthProfile_id);
    if (!profile) return res.status(404).json({ message: 'Health profile not found' });

    // 4. Kiểm tra specialty có tồn tại
    const specialty = await Specialty.findById(specialty_id);
    if (!specialty) return res.status(404).json({ message: 'Specialty not found' });

    // 5. Tạo appointment mới (chưa gán doctor => doctor_id null)
    const newAppointment = new Appointment({
      booker_id,
      healthProfile_id,
      specialty_id,
      appointmentDate,
      timeSlot,
      reason,
      status: "waiting_assigned",
      doctor_id: null
    });

    await newAppointment.save();

    return res.status(201).json({
      message: 'Appointment booked successfully by specialty',
      appointment: newAppointment
    });

  } catch (error) {
    console.error("Error creating appointment by specialty:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// [PUT] /appointments/:id/cancel
module.exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    appointment.status = 'cancelled';
    await appointment.save();
    res.status(200).json({ message: 'Appointment cancelled successfully', appointment });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// [GET] /appointments/doctor/:id/today
module.exports.getAppointmentsByDoctorToday = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;

    // Get today's date range (start and end of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const filter = {
      doctor_id: id,
      appointmentDate: { $gte: today, $lt: tomorrow }
    };
    if (status) filter.status = status;

    let appointments = await Appointment.find(filter)
      .populate('healthProfile_id specialty_id')
      .sort({ timeSlot: 1 }); // Sort by time slot for today's schedule

    if (!appointments.length) {
      return res.status(200).json({
        message: 'No appointments found for this doctor today',
        count: 0,
        appointments: []
      });
    }

    // Append owner info (Patient or FamilyMember)
    const final = await Promise.all(
      appointments.map(async (app) => {
        const hp = app.healthProfile_id;

        if (!hp || !hp.ownerId || !hp.ownerModel) return app.toObject();

        let owner;
        if (hp.ownerModel === "Patient") {
          owner = await Patient.findById(hp.ownerId)
            .select("name dob phone gender");
        } else if (hp.ownerModel === "FamilyMember") {
          owner = await FamilyMember.findById(hp.ownerId)
            .select("name dob phone gender");
        }

        return {
          ...app.toObject(),
          healthProfile_id: {
            ...hp.toObject(),
            owner_detail: owner || null
          }
        };
      })
    );

    res.status(200).json({ count: final.length, appointments: final });

  } catch (error) {
    console.error('Error fetching doctor appointments for today:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};