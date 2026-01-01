const request = require('supertest');
const express = require('express');
const appointmentRoutes = require('../src/routes/appointmentRoutes');
const database = require('../config/database');
const Appointment = require('../src/models/appointment');
const Patient = require('../src/models/patient');
const Account = require('../src/models/account');
const HealthProfile = require('../src/models/healthProfile');
const Specialty = require('../src/models/specialty');
const Doctor = require('../src/models/doctor'); // Import Doctor model
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Update MongoMemoryServer setup
const mongodOptions = {
  instance: {
    dbName: 'test',
  },
  binary: {
    downloadDir: './mongodb-binaries',
  },
  autoStart: false,
  timeoutMS: 30000, // Increased timeout
};

let mongod; // Declare mongod globally

const app = express();
app.use(express.json());
app.use('/appointments', appointmentRoutes);

jest.setTimeout(10000);

describe('Appointment Controller (by-specialty)', () => {
  // ...existing code...
  let patient;
  let healthProfile;
  let specialty;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create(mongodOptions);
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri; // Set the in-memory MongoDB URI
    await mongoose.connect(uri); // Removed deprecated options
    await database.connect();

    // create account + patient
    const acc = await Account.create({ email: 'appt@test.com', password: 'x', roleId: null, status: 'active', deleted: false });
    patient = await Patient.create({ accountId: acc._id, name: 'APPT PAT', phone: '0901111222' });

    // create health profile
    healthProfile = await HealthProfile.create({ ownerModel: 'Patient', ownerId: patient._id });

    // create specialty
    specialty = await Specialty.create({ name: 'Test Specialty' });
  });

  afterAll(async () => {
    if (mongod) {
      await mongod.stop(); // Ensure MongoMemoryServer is stopped after tests
    }
    await mongoose.disconnect();
  });

  it('tạo appointment bằng specialty thành công', async () => {
    const payload = {
      booker_id: String(patient._id),
      healthProfile_id: String(healthProfile._id),
      specialty_id: String(specialty._id),
      appointmentDate: new Date().toISOString(),
      timeSlot: '09:00 - 09:30',
      reason: 'Checkup'
    };

    const res = await request(app).post('/appointments/by-specialty').send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('appointment');
    expect(res.body.appointment).toHaveProperty('status', 'waiting_assigned');
  });

  it('thiếu trường bắt buộc trả về 400', async () => {
    const res = await request(app).post('/appointments/by-specialty').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Missing required fields');
  });

  it('booker không tồn tại trả về 404', async () => {
    const payload = {
      booker_id: new mongoose.Types.ObjectId(),
      healthProfile_id: String(healthProfile._id),
      specialty_id: String(specialty._id),
      appointmentDate: new Date().toISOString(),
      timeSlot: '10:00 - 10:30',
      reason: 'Test'
    };
    const res = await request(app).post('/appointments/by-specialty').send(payload);
    expect(res.status).toBe(404);
  });

  it('specialty không tồn tại trả về 404', async () => {
    const payload = {
      booker_id: String(patient._id),
      healthProfile_id: String(healthProfile._id),
      specialty_id: new mongoose.Types.ObjectId(),
      appointmentDate: new Date().toISOString(),
      timeSlot: '11:00 - 11:30',
      reason: 'Test'
    };
    const res = await request(app).post('/appointments/by-specialty').send(payload);
    expect(res.status).toBe(404);
  });

  it('healthProfile không tồn tại trả về 404', async () => {
    const payload = {
      booker_id: String(patient._id),
      healthProfile_id: new mongoose.Types.ObjectId(),
      specialty_id: String(specialty._id),
      appointmentDate: new Date().toISOString(),
      timeSlot: '12:00 - 12:30',
      reason: 'Test'
    };
    const res = await request(app).post('/appointments/by-specialty').send(payload);
    expect(res.status).toBe(404);
  });

  describe('Booking by doctor', () => {
    let doctor;
    let docAccount;
    let scheduleDate;

    beforeAll(async () => {
      // create doctor account and doctor
      docAccount = await Account.create({ email: 'doc@test.com', password: 'x', roleId: null, status: 'active', deleted: false });
      doctor = await Doctor.create({ accountId: docAccount._id, name: 'Dr Test', specialtyId: specialty._id });

      // schedule for today with one slot
      scheduleDate = new Date();
      const dateOnly = new Date(scheduleDate);
      dateOnly.setHours(0, 0, 0, 0);
      await require('../src/models/schedule').create({
        doctor_id: doctor._id,
        date: dateOnly,
        timeSlots: [{ startTime: '09:00', endTime: '09:30', isBooked: false }]
      });
    });

    afterAll(async () => {
      await require('../src/models/schedule').deleteMany({ doctor_id: doctor._id });
      await require('../src/models/doctor').deleteMany({ _id: doctor._id });
      await Account.deleteMany({ email: 'doc@test.com' });
    });

    it('tạo appointment theo bác sĩ thành công', async () => {
      const payload = {
        booker_id: String(patient._id),
        healthProfile_id: String(healthProfile._id),
        doctor_id: String(doctor._id),
        appointmentDate: new Date().toISOString(),
        timeSlot: '09:00 - 09:30',
        reason: 'Doctor booking'
      };

      const res = await request(app).post('/appointments/by-doctor').send(payload);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toMatch(/Appointment booked successfully with doctor/);
      expect(res.body.appointment).toHaveProperty('doctor_id');
    });

    it('không đặt được khi slot đã bị đặt', async () => {
      // attempt to book same slot again
      const payload = {
        booker_id: String(patient._id),
        healthProfile_id: String(healthProfile._id),
        doctor_id: String(doctor._id),
        appointmentDate: new Date().toISOString(),
        timeSlot: '09:00 - 09:30',
        reason: 'Doctor booking duplicate'
      };
      const res = await request(app).post('/appointments/by-doctor').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Time slot already booked/);
    });

    it('trả về 400 khi bác sĩ không có lịch cho ngày', async () => {
      // use a future date with no schedule
      const future = new Date();
      future.setDate(future.getDate() + 10);
      const payload = {
        booker_id: String(patient._id),
        healthProfile_id: String(healthProfile._id),
        doctor_id: String(doctor._id),
        appointmentDate: future.toISOString(),
        timeSlot: '10:00 - 10:30',
        reason: 'No schedule'
      };
      const res = await request(app).post('/appointments/by-doctor').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Doctor has no schedule for this date');
    });

    it('trả về 404 khi bác sĩ không tồn tại', async () => {
      const payload = {
        booker_id: String(patient._id),
        healthProfile_id: String(healthProfile._id),
        doctor_id: String(new mongoose.Types.ObjectId()),
        appointmentDate: new Date().toISOString(),
        timeSlot: '09:00 - 09:30',
        reason: 'Doctor missing'
      };
      const res = await request(app).post('/appointments/by-doctor').send(payload);
      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/Doctor not found/);
    });

    it('trả về 400 khi timeSlot không hợp lệ', async () => {
      const payload = {
        booker_id: String(patient._id),
        healthProfile_id: String(healthProfile._id),
        doctor_id: String(doctor._id),
        appointmentDate: new Date().toISOString(),
        timeSlot: 'invalid-slot-format',
        reason: 'Bad timeslot'
      };
      const res = await request(app).post('/appointments/by-doctor').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid time slot/);
    });

    it('trả về 400 khi thiếu trường bắt buộc (booker_id)', async () => {
      const payload = {
        // missing booker_id
        healthProfile_id: String(healthProfile._id),
        doctor_id: String(doctor._id),
        appointmentDate: new Date().toISOString(),
        timeSlot: '09:00 - 09:30',
        reason: 'Missing booker'
      };
      const res = await request(app).post('/appointments/by-doctor').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Missing required fields');
    });
  });
  describe('Delete appointment', () => {
    it('xóa appointment thành công', async () => {
      // create an appointment to delete
      const appt = await Appointment.create({
        booker_id: patient._id,
        healthProfile_id: healthProfile._id,
        specialty_id: specialty._id,
        appointmentDate: new Date(),
        timeSlot: '13:00 - 13:30',
        reason: 'To be deleted',
        status: 'waiting_assigned'
      });
      const res = await request(app).delete(`/appointments/${appt._id}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Appointment deleted successfully');
    });

    it('xóa appointment không tồn tại trả về 404', async () => {
      const res = await request(app).delete(`/appointments/${new mongoose.Types.ObjectId()}`);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Appointment not found');
    });
    it('xóa appointment với id không hợp lệ trả về 400', async () => {
      const res = await request(app).delete('/appointments/invalid-id');
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid appointment ID');
    });
  });
  describe('Update appointment status', () => {
    let appointment;

    beforeEach(async () => {
      // Create a test appointment with all required fields
      appointment = await Appointment.create({
        booker_id: new mongoose.Types.ObjectId(),
        healthProfile_id: new mongoose.Types.ObjectId(),
        specialty_id: new mongoose.Types.ObjectId(),
        reason: 'Test reason',
        appointmentDate: new Date(),
        timeSlot: '10:00 AM',
        status: 'pending',
      });
    });

    it('should update appointment status successfully', async () => {
      const res = await request(app)
        .patch(`/appointments/${appointment._id}/status`)
        .send({ status: 'confirmed' });

      expect(res.status).toBe(200);
      expect(res.body.appointment).toHaveProperty('status', 'confirmed');
    });

    it('should return 400 for invalid status', async () => {
      const res = await request(app)
        .patch(`/appointments/${appointment._id}/status`)
        .send({ status: 'invalid-status' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid status value');
    });

    it('should return 404 for non-existent appointment', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/appointments/${nonExistentId}/status`)
        .send({ status: 'confirmed' });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Appointment not found');
    });
  });
});