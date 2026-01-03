const Appointment = require('../models/appointment');
const Patient = require('../models/patient');
const Doctor = require('../models/doctor');
const Schedule = require('../models/schedule');
const Specialty = require('../models/specialty');
const HealthProfile = require('../models/healthProfile');
const FamilyMember = require('../models/familyMember');
const Account = require('../models/account');
const { sendMail } = require('../helpers/sendMail');
const {
  createPatientSnapshot,
  createDoctorSnapshot,
  createSpecialtySnapshot
} = require('../helpers/appointmentSnapshot');
const mongoose = require('mongoose');
// [POST] /appointments/by-doctor
module.exports.createByDoctor = async (req, res) => {
  try {
    const {
      booker_id,
      healthProfile_id,
      doctor_id,
      specialty_id,
      appointmentDate,
      timeSlot,
      reason,
    } = req.body;

    // ==== 1. Validate cơ bản ====
    if (
      !booker_id ||
      !healthProfile_id ||
      !appointmentDate ||
      !timeSlot ||
      !reason
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // ==== 2. Kiểm tra bệnh nhân ====
    const booker = await Patient.findById(booker_id);
    if (!booker)
      return res
        .status(404)
        .json({ message: "Profile not found or not owned by booker" });

    // ==== 3. Kiểm tra health profile ====
    const profile = await HealthProfile.findById(healthProfile_id);
    if (!profile) {
      return res.status(404).json({ message: "Health profile not found" });
    }

    // ==== 4. Đặt theo bác sĩ ====
    let doctor, specialty;
    if (doctor_id && !specialty_id) {
      doctor = await Doctor.findById(doctor_id);
      if (!doctor) return res.status(404).json({ message: "Doctor not found" });

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
        return res
          .status(400)
          .json({ message: "Doctor has no schedule for this date" });
      }

      // Tìm slot
      const normalize = (t) => t.split(" ")[0].split("-")[0].trim().slice(0, 5); // lấy "HH:MM"
      const normalizedInput = normalize(timeSlot);

      const slot = schedule.timeSlots.find(
        (s) => normalize(s.startTime) === normalizedInput
      );
      if (!slot) return res.status(400).json({ message: "Invalid time slot" });

      if (slot.isBooked)
        return res.status(400).json({ message: "Time slot already booked" });

      // Tạo snapshots
      const [patientSnapshot, doctorSnapshot, specialtySnapshot] = await Promise.all([
        createPatientSnapshot(healthProfile_id),
        createDoctorSnapshot(doctor._id),
        createSpecialtySnapshot(specialty)
      ]);

      // Tạo appointment
      const newAppointment = new Appointment({
        booker_id,
        healthProfile_id,
        doctor_id: doctor._id,
        specialty_id: specialty,
        appointmentDate,
        timeSlot,
        reason,
        status: "pending",
        patientSnapshot,
        doctorSnapshot,
        specialtySnapshot
      });

      await newAppointment.save();

      // Cập nhật schedule: tìm bằng khoảng ngày giống lúc lấy schedule và match startTime (không match cả chuỗi timeSlot)
      const updateResult = await Schedule.findOneAndUpdate(
        {
          doctor_id,
          date: { $gte: startOfDay, $lte: endOfDay },
          "timeSlots.startTime": slot.startTime,
        },
        {
          $set: {
            "timeSlots.$.isBooked": true,
            "timeSlots.$.appointment_id": newAppointment._id,
          },
        },
        { new: true }
      );

      // Nếu không update được bằng startTime chính xác, thử match bằng phần bắt đầu của timeSlot (normalize)
      if (!updateResult) {
        const fallback = await Schedule.findOneAndUpdate(
          {
            doctor_id,
            date: { $gte: startOfDay, $lte: endOfDay },
            "timeSlots.startTime": { $regex: `^${normalizedInput}` },
          },
          {
            $set: {
              "timeSlots.$.isBooked": true,
              "timeSlots.$.appointment_id": newAppointment._id,
            },
          },
          { new: true }
        );
        console.log("Schedule update fallback result:", !!fallback);
      } else {
        console.log("Schedule updated for appointment slot:", slot.startTime);
      }

      return res.status(201).json({
        message: "Appointment booked successfully with doctor",
        appointment: newAppointment,
      });
    }
  } catch (error) {
    console.error("Error creating appointment:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// [PUT] /appointments/:id/assign-doctor
module.exports.assignDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { doctor_id } = req.body;

    if (!doctor_id) {
      return res.status(400).json({ message: "doctor_id is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(doctor_id)) {
      return res.status(400).json({ message: 'Invalid doctor_id' });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.status !== 'waiting_assigned') {
      return res.status(400).json({
        message: 'Only appointments with status "waiting_assigned" can be assigned',
      });
    }

    const doctor = await Doctor.findById(doctor_id);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    if (doctor.specialtyId.toString() !== appointment.specialty_id.toString()) {
      return res.status(400).json({
        message: 'Doctor specialty does not match appointment specialty',
      });
    }

    const dateOnly = new Date(appointment.appointmentDate);
    dateOnly.setHours(0, 0, 0, 0);
    const nextDay = new Date(dateOnly);
    nextDay.setDate(nextDay.getDate() + 1);

    const schedule = await Schedule.findOne({
      doctor_id: doctor._id,
      date: { $gte: dateOnly, $lt: nextDay },
    });

    if (!schedule) {
      return res.status(400).json({
        message: 'Doctor has no schedule for this date',
      });
    }

    const normalize = t => t.split(' ')[0].slice(0, 5);
    const appointmentTime = normalize(appointment.timeSlot);

    const slotIndex = schedule.timeSlots.findIndex(
      s => normalize(s.startTime) === appointmentTime
    );

    if (slotIndex === -1) {
      return res.status(400).json({
        message: 'Time slot not found in doctor schedule',
      });
    }

    if (schedule.timeSlots[slotIndex].isBooked) {
      return res.status(400).json({
        message: 'This time slot is already booked by another patient',
      });
    }

    // Tạo doctor snapshot
    const doctorSnapshot = await createDoctorSnapshot(doctor._id);
    
    appointment.doctor_id = doctor._id;
    appointment.status = "pending";
    appointment.doctorSnapshot = doctorSnapshot;
    await appointment.save();

    schedule.timeSlots[slotIndex].isBooked = true;
    schedule.timeSlots[slotIndex].appointment_id = appointment._id;
    await schedule.save();

    return res.status(200).json({
      message: "Doctor assigned successfully to appointment",
      appointment,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// [PUT] /appointments/:id/status
module.exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["pending", "confirmed", "cancelled", "completed"];
    if (!validStatuses.includes(status))
      return res.status(400).json({ message: "Invalid status value" });

    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    res
      .status(200)
      .json({ message: "Appointment status updated", appointment });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// [PUT] /appointments/:id
module.exports.updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    if (!updatedAppointment)
      return res.status(404).json({ message: "Appointment not found" });
    res.status(200).json({
      message: "Appointment updated successfully",
      appointment: updatedAppointment,
    });
  } catch (error) {
    console.error("Error updating appointment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
// [GET] /appointments
module.exports.getAllAppointments = async (req, res) => {
  try {
    const { doctor_id, booker_id, status, date, specialty_id, page, limit } =
      req.query;
    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;

    const filter = {};
    if (doctor_id) filter.doctor_id = doctor_id;
    if (booker_id) filter.booker_id = booker_id;
    if (specialty_id) filter.specialty_id = specialty_id;
    if (status) filter.status = status;
    if (date) filter.appointmentDate = new Date(date);

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .select('appointmentDate timeSlot reason status patientSnapshot doctorSnapshot specialtySnapshot createdAt booker_id doctor_id specialty_id healthProfile_id')
        .sort({ appointmentDate: 1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),
      Appointment.countDocuments(filter),
    ]);

    // Sử dụng snapshot đã có thay vì populate
    const appointmentsWithSnapshot = appointments.map(app => ({
      ...app,
      patient: app.patientSnapshot || null,
      doctor: app.doctorSnapshot || null,
      specialty: app.specialtySnapshot || null
    }));

    res.status(200).json({
      data: appointmentsWithSnapshot,
      meta: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// [GET] /appointments/doctor/:accountId
module.exports.getAppointmentsByDoctor = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { date, status } = req.query;

    // Find doctor by account ID
    const doctor = await Doctor.findOne({ accountId: accountId });
    if (!doctor) {
      return res
        .status(404)
        .json({ message: "Doctor not found for this account" });
    }

    const filter = { doctor_id: doctor._id };
    if (date) filter.appointmentDate = new Date(date);
    if (status) filter.status = status;

    // Chỉ select các fields cần thiết, KHÔNG populate
    const appointments = await Appointment.find(filter)
      .select('appointmentDate timeSlot reason status patientSnapshot specialtySnapshot createdAt healthProfile_id')
      .sort({ appointmentDate: 1 })
      .lean(); // Use lean() for better performance

    if (!appointments.length)
      return res
        .status(404)
        .json({ message: "No appointments found for this doctor" });

    // Sử dụng snapshot đã có, không cần query thêm
    const final = appointments.map(app => ({
      ...app,
      patient: app.patientSnapshot || null,
      specialty: app.specialtySnapshot || null
    }));

    res.status(200).json({ count: final.length, appointments: final });
  } catch (error) {
    console.error("Error fetching doctor appointments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// [GET] /appointments/booker/:accountId
module.exports.getAppointmentsByBooker = async (req, res) => {
  try {
    const { accountId } = req.params; // account_id
    const { date, status } = req.query;

    // Find patient by account ID
    const patient = await Patient.findOne({ accountId: accountId });
    if (!patient) {
      return res
        .status(404)
        .json({ message: "Patient not found for this account" });
    }

    const filter = { booker_id: patient._id };
    if (date) filter.appointmentDate = new Date(date);
    if (status) filter.status = status;

    // Sử dụng snapshot, không populate
    const appointments = await Appointment.find(filter)
      .select('appointmentDate timeSlot reason status patientSnapshot doctorSnapshot specialtySnapshot createdAt healthProfile_id')
      .sort({ appointmentDate: -1 })
      .lean();

    if (!appointments.length)
      return res
        .status(404)
        .json({ message: "No appointments found for this patient" });

    // Sử dụng snapshot đã có
    const final = appointments.map(app => ({
      ...app,
      patient: app.patientSnapshot || null,
      doctor: app.doctorSnapshot || null,
      specialty: app.specialtySnapshot || null
    }));

    res.status(200).json({ count: final.length, appointments: final });
  } catch (error) {
    console.error("Error fetching patient appointments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// [GET] /appointments/:id
module.exports.getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .select('appointmentDate timeSlot reason status patientSnapshot doctorSnapshot specialtySnapshot booker_id doctor_id specialty_id healthProfile_id createdAt')
      .lean();

    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    // Sử dụng snapshot
    const result = {
      ...appointment,
      patient: appointment.patientSnapshot || null,
      doctor: appointment.doctorSnapshot || null,
      specialty: appointment.specialtySnapshot || null
    };

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching appointment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// [POST] /appointments/by-specialty
module.exports.createBySpecialty = async (req, res) => {
  try {
    const {
      booker_id,
      healthProfile_id,
      specialty_id,
      appointmentDate,
      timeSlot,
      reason,
    } = req.body;

    // 1. Validate
    if (
      !booker_id ||
      !healthProfile_id ||
      !specialty_id ||
      !appointmentDate ||
      !timeSlot ||
      !reason
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // 2. Kiểm tra bệnh nhân có tồn tại
    const booker = await Patient.findById(booker_id);
    if (!booker) {
      return res.status(404).json({ message: "Booker not found" });
    }

    // 3. Kiểm tra health profile thuộc về bệnh nhân này
    const profile = await HealthProfile.findById(healthProfile_id);
    if (!profile)
      return res.status(404).json({ message: "Health profile not found" });

    // 4. Kiểm tra specialty có tồn tại
    const specialty = await Specialty.findById(specialty_id);
    if (!specialty)
      return res.status(404).json({ message: "Specialty not found" });

    // 5. Tạo snapshots (patient và specialty, chưa có doctor)
    const [patientSnapshot, specialtySnapshot] = await Promise.all([
      createPatientSnapshot(healthProfile_id),
      createSpecialtySnapshot(specialty_id)
    ]);

    // 6. Tạo appointment mới (chưa gán doctor => doctor_id null)
    const newAppointment = new Appointment({
      booker_id,
      healthProfile_id,
      specialty_id,
      appointmentDate,
      timeSlot,
      reason,
      status: "waiting_assigned",
      doctor_id: null,
      patientSnapshot,
      specialtySnapshot
    });

    await newAppointment.save();

    return res.status(201).json({
      message: "Appointment booked successfully by specialty",
      appointment: newAppointment,
    });
  } catch (error) {
    console.error("Error creating appointment by specialty:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Add validation for ObjectId in deleteAppointment
module.exports.deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid appointment ID' });
    }

    const appointment = await Appointment.findByIdAndDelete(id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    res.status(200).json({ message: "Appointment deleted successfully" });
  } catch (error) {
    console.error("Error deleting appointment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// [PUT] /appointments/:id/cancel
module.exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    appointment.status = "cancelled";
    await appointment.save();
    res
      .status(200)
      .json({ message: "Appointment cancelled successfully", appointment });
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// [PUT] /appointments/:id/confirm
module.exports.confirmAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    appointment.status = "confirmed";
    await appointment.save();

    // Lấy email bệnh nhân (booker_id = patientId)
    const patient = await Patient.findById(appointment.booker_id);
    if (!patient) {
      console.warn("Patient not found - skip sending mail");
      return res
        .status(200)
        .json({ message: "Appointment confirmed", appointment });
    }

    const account = await Account.findById(patient.accountId);
    const email = account?.email;
    if (!email) {
      console.warn("Patient email not found - skip sending mail");
      return res
        .status(200)
        .json({ message: "Appointment confirmed", appointment });
    }

    // Sử dứng snapshot thay vì query
    const patientName = appointment.patientSnapshot?.name || "Bệnh nhân";
    const doctorName = appointment.doctorSnapshot?.name || "Bác sĩ";
    const specialtyName = appointment.specialtySnapshot?.name || "";

    // Format ngày hẹn
    const dateStr = new Date(appointment.appointmentDate).toLocaleDateString(
      "vi-VN"
    );

    // Gửi email dùng sendMail()
    const subject = "Xác nhận lịch hẹn khám bệnh";
    const html = `
      <h3>Xin chào ${patient.name},</h3>
      <p>Bác sĩ <strong>${doctorName}</strong> đã <strong>xác nhận lịch hẹn</strong> của bệnh nhân <strong>${patientName}</strong>.</p>
      <p>Vui lòng chuẩn bị đến phòng khám vào ngày: <strong>${dateStr}</strong></p>
      <p>Khung giờ: <strong>${appointment.timeSlot}</strong></p>
      <p>Chuyên khoa: <strong>${specialtyName}</strong></p>
      <p>Nếu có bất kỳ thay đổi nào, vui lòng liên hệ với chúng tôi qua email này hoặc số điện thoại hỗ trợ.</p>
      <p>Nên có mặt trước 15 phút để làm thủ tục đăng ký và chuẩn bị khám bệnh.</p>
      <br/>
      <p>Trân trọng,</p>
      <p>Hệ thống phòng khám ProHealth.</p>
      <p>Số 123, Nguyễn Trãi, Thanh Xuân, Hà Nội.</p>
    `;

    await sendMail(email, subject, html);

    res
      .status(200)
      .json({ message: "Appointment confirmed successfully", appointment });
  } catch (error) {
    console.error("Error confirming appointment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// [GET] /appointments/doctor/:accountId/today
module.exports.getAppointmentsByDoctorToday = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { status } = req.query;

    // Find doctor by account ID
    const doctor = await Doctor.findOne({ accountId: accountId });
    if (!doctor) {
      return res
        .status(404)
        .json({ message: "Doctor not found for this account" });
    }

    // Get today's date range (start and end of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const filter = {
      doctor_id: doctor._id,
      appointmentDate: { $gte: today, $lt: tomorrow },
    };
    if (status) filter.status = status;

    // Sử dụng snapshot cho performance, nhưng vẫn populate healthProfile cho medical info
    const appointments = await Appointment.find(filter)
      .select('appointmentDate timeSlot reason status patientSnapshot specialtySnapshot createdAt healthProfile_id doctor_id')
      .populate('healthProfile_id')
      .sort({ timeSlot: 1 })
      .lean();

    if (!appointments.length) {
      return res.status(200).json({
        message: "No appointments found for this doctor today",
        count: 0,
        appointments: [],
      });
    }

    // Sử dụng snapshot đã có
    const final = appointments.map(app => ({
      ...app,
      patient: app.patientSnapshot || null,
      specialty: app.specialtySnapshot || null
    }));

    res.status(200).json({ count: final.length, appointments: final });
  } catch (error) {
    console.error("Error fetching doctor appointments for today:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// [GET] /appointments/booker/:accountId/month
module.exports.getMonthAppointmentByBooker = async (req, res) => {
  try {
    const { accountId } = req.params; // account_id
    const { status, date } = req.query; // date format: YYYY-MM-DD or YYYY-MM or any valid date string

    // Find patient by account ID
    const patient = await Patient.findOne({ accountId: accountId });
    if (!patient) {
      return res
        .status(404)
        .json({ message: "Patient not found for this account" });
    }

    // Determine the reference date (from query param or current date)
    let referenceDate;
    if (date) {
      referenceDate = new Date(date);
      // Validate date
      if (isNaN(referenceDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
    } else {
      referenceDate = new Date();
    }

    // Get month date range based on reference date
    const startOfMonth = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      1
    );
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() + 1,
      0
    );
    endOfMonth.setHours(23, 59, 59, 999);

    const filter = {
      booker_id: patient._id,
      appointmentDate: { $gte: startOfMonth, $lte: endOfMonth },
    };
    if (status) filter.status = status;

    // Sử dụng snapshot, không populate
    const appointments = await Appointment.find(filter)
      .select('appointmentDate timeSlot reason status patientSnapshot doctorSnapshot specialtySnapshot createdAt healthProfile_id')
      .sort({ appointmentDate: 1, timeSlot: 1 })
      .lean();

    if (!appointments.length) {
      return res.status(200).json({
        message: "No appointments found for this patient in this month",
        count: 0,
        appointments: [],
        month: referenceDate.getMonth() + 1,
        year: referenceDate.getFullYear(),
      });
    }

    // Sử dụng snapshot đã có
    const final = appointments.map(app => ({
      ...app,
      patient: app.patientSnapshot || null,
      doctor: app.doctorSnapshot || null,
      specialty: app.specialtySnapshot || null
    }));

    res.status(200).json({
      count: final.length,
      appointments: final,
      month: referenceDate.getMonth() + 1,
      year: referenceDate.getFullYear(),
    });
  } catch (error) {
    console.error("Error fetching patient appointments for month:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// [GET] /appointments/doctor/:accountId/month
module.exports.getMonthAppointmentByDoctor = async (req, res) => {
  try {
    const { accountId } = req.params; // account_id
    const { status, date } = req.query; // date format: YYYY-MM-DD or YYYY-MM or any valid date string

    // Find doctor by account ID
    const doctor = await Doctor.findOne({ accountId: accountId });
    if (!doctor) {
      return res
        .status(404)
        .json({ message: "Doctor not found for this account" });
    }

    // Determine the reference date (from query param or current date)
    let referenceDate;
    if (date) {
      referenceDate = new Date(date);
      // Validate date
      if (isNaN(referenceDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
    } else {
      referenceDate = new Date();
    }

    // Get month date range based on reference date
    const startOfMonth = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      1
    );
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() + 1,
      0
    );
    endOfMonth.setHours(23, 59, 59, 999);

    const filter = {
      doctor_id: doctor._id,
      appointmentDate: { $gte: startOfMonth, $lte: endOfMonth },
    };
    if (status) filter.status = status;

    // Sử dụng snapshot, không populate
    const appointments = await Appointment.find(filter)
      .select('appointmentDate timeSlot reason status patientSnapshot specialtySnapshot createdAt healthProfile_id')
      .sort({ appointmentDate: 1, timeSlot: 1 })
      .lean();

    if (!appointments.length) {
      return res.status(200).json({
        message: "No appointments found for this doctor in this month",
        count: 0,
        appointments: [],
        month: referenceDate.getMonth() + 1,
        year: referenceDate.getFullYear(),
      });
    }

    // Sử dụng snapshot đã có
    const final = appointments.map(app => ({
      ...app,
      patient: app.patientSnapshot || null,
      specialty: app.specialtySnapshot || null
    }));

    res.status(200).json({
      count: final.length,
      appointments: final,
      month: referenceDate.getMonth() + 1,
      year: referenceDate.getFullYear(),
    });
  } catch (error) {
    console.error("Error fetching doctor appointments for month:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
