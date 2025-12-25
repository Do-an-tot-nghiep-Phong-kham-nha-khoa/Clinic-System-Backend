const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

const appointmentRoutes = require('../src/routes/appointmentRoutes');
const Appointment = require('../src/models/appointment');
const Doctor = require('../src/models/doctor');
const Schedule = require('../src/models/schedule');

require('./setup');

const app = express();
app.use(express.json());
app.use('/appointments', appointmentRoutes);

// ===== Mock data =====
const appointmentId = new mongoose.Types.ObjectId();
const doctorId = new mongoose.Types.ObjectId();
const specialtyId = new mongoose.Types.ObjectId();

const mockAppointment = {
  _id: appointmentId,
  booker_id: new mongoose.Types.ObjectId(),
  healthProfile_id: new mongoose.Types.ObjectId(),
  doctor_id: null,
  specialty_id: specialtyId,
  appointmentDate: new Date(),
  timeSlot: '09:00 AM - 09:30 AM',
  status: 'waiting_assigned',
  save: jest.fn(),
};

const mockDoctor = {
  _id: doctorId,
  specialtyId,
};

const mockSchedule = {
  _id: new mongoose.Types.ObjectId(),
  doctor_id: doctorId,
  date: new Date(),
  timeSlots: [
    {
      startTime: '09:00 AM',
      isBooked: false,
    },
  ],
  save: jest.fn(),
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Appointment Controller - assignDoctor', () => {
  it('should assign a doctor successfully', async () => {
    jest.spyOn(Appointment, 'findById').mockResolvedValue(mockAppointment);
    jest.spyOn(Doctor, 'findById').mockResolvedValue(mockDoctor);
    jest.spyOn(Schedule, 'findOne').mockResolvedValue(mockSchedule);

    const res = await request(app)
      .put(`/appointments/${appointmentId}/assign-doctor`)
      .send({ doctor_id: doctorId });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Doctor assigned successfully to appointment');
    expect(mockAppointment.doctor_id.toString()).toBe(doctorId.toString());
    expect(mockAppointment.status).toBe('pending');
    expect(mockAppointment.save).toHaveBeenCalled();
    expect(mockSchedule.save).toHaveBeenCalled();
  });

  it('should return 404 if appointment not found', async () => {
    jest.spyOn(Appointment, 'findById').mockResolvedValue(null);

    const res = await request(app)
      .put(`/appointments/${appointmentId}/assign-doctor`)
      .send({ doctor_id: doctorId });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Appointment not found');
  });

  it('should return 400 if doctor_id is missing', async () => {
    jest.spyOn(Appointment, 'findById').mockResolvedValue(mockAppointment);

    const res = await request(app)
      .put(`/appointments/${appointmentId}/assign-doctor`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('doctor_id is required');
  });

  it('should return 404 if doctor not found', async () => {
    jest.spyOn(Appointment, 'findById').mockResolvedValue(mockAppointment);
    jest.spyOn(Doctor, 'findById').mockResolvedValue(null);

    const res = await request(app)
      .put(`/appointments/${appointmentId}/assign-doctor`)
      .send({ doctor_id: doctorId });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Doctor not found');
  });

  it('should return 400 if doctor specialty does not match', async () => {
    const wrongDoctor = {
      ...mockDoctor,
      specialtyId: new mongoose.Types.ObjectId(),
    };

    jest.spyOn(Appointment, 'findById').mockResolvedValue(mockAppointment);
    jest.spyOn(Doctor, 'findById').mockResolvedValue(wrongDoctor);

    const res = await request(app)
      .put(`/appointments/${appointmentId}/assign-doctor`)
      .send({ doctor_id: wrongDoctor._id });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Doctor specialty does not match appointment specialty'
    );
  });
});
