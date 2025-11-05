const Appointment = require('../models/appointment');
const Patient = require('../models/patient');
const Doctor = require('../models/doctor');
const Schedule = require('../models/schedule');
const Specialty = require('../models/specialty');
const HealthProfile = require('../models/healthProfile');

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
      // dateOnly.setHours(0, 0, 0, 0);
      const schedule = await Schedule.findOne({
        doctor_id,
        date: dateOnly,
      });

      if (!schedule) {
        return res.status(400).json({ message: 'Doctor has no schedule for this date' });
      }

      // Tìm slot
      const slot = schedule.timeSlots.find((s) => s.startTime === timeSlot);
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

      // Cập nhật schedule
      await Schedule.findOneAndUpdate(
        { doctor_id, date: dateOnly, "timeSlots.startTime": timeSlot },
        { $set: { "timeSlots.$.isBooked": true } },
        { new: true }
      );

      return res.status(201).json({
        message: 'Appointment booked successfully with doctor',
        appointment: newAppointment,
      });
    }

    // // ==== 4. Nếu đặt theo chuyên khoa ====
    // if (!specialty_id) {
    //   return res.status(400).json({ message: 'specialty_id is required when booking by specialty' });
    // }

    // specialty = await Specialty.findById(specialty_id);
    // if (!specialty) return res.status(404).json({ message: 'Specialty not found' });

    // const newAppointment = new Appointment({
    //   booker_id,
    //   profile: profileId,
    //   profileModel,
    //   specialty_id: specialty._id,
    //   appointmentDate,
    //   timeSlot,
    //   reason,
    //   status: "waiting_assigned"
    // });

    // await newAppointment.save();

    // return res.status(201).json({
    //   message: 'Appointment booked successfully under specialty (waiting for doctor assignment)',
    //   appointment: newAppointment,
    // });

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

    // Bác sĩ phải cùng chuyên khoa với lịch hẹn
    if (doctor.specialtyId.toString() !== appointment.specialty_id.toString()) {
      return res.status(400).json({ message: 'Doctor specialty does not match appointment specialty' });
    }

    // ==== 4. Tìm schedule của bác sĩ cho ngày đó ====
    const schedule = await Schedule.findOne({
      doctor_id: doctor._id,
      date: new Date(appointment.appointmentDate),
    });

    if (!schedule) {
      return res.status(400).json({ message: 'Doctor has no schedule for this date' });
    }

    // ==== 5. Kiểm tra slot có trống không ====
    const slotIndex = schedule.timeSlots.findIndex(
      slot => slot.startTime === appointment.timeSlot
    );

    if (slotIndex === -1) {
      return res.status(400).json({ message: 'Invalid time slot for this doctor' });
    }

    if (schedule.timeSlots[slotIndex].isBooked) {
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
    const { id } = req.params; // doctor_id
    const { date, status } = req.query;

    const filter = { doctor_id: id };
    if (date) filter.appointmentDate = new Date(date);
    if (status) filter.status = status;

    const appointments = await Appointment.find(filter)
      .populate('doctor_id specialty_id booker_id')
      .sort({ appointmentDate: 1 });

    if (!appointments.length)
      return res.status(404).json({ message: 'No appointments found for this doctor' });

    res.status(200).json({ count: appointments.length, appointments });
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// [GET] /appointments/booker/:id
module.exports.getAppointmentsByBooker = async (req, res) => {
  try {
    const { id } = req.params; // booker_id
    const { status } = req.query;

    const filter = { booker_id: id };
    if (status) filter.status = status;

    const appointments = await Appointment.find(filter)
      .populate('doctor_id specialty_id booker_id')
      .sort({ appointmentDate: -1 });

    if (!appointments.length)
      return res.status(404).json({ message: 'No appointments found for this patient' });

    res.status(200).json({ count: appointments.length, appointments });
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
