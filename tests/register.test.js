const request = require('supertest');
const express = require('express');
const accountRoutes = require('../src/routes/accountRoutes');
const database = require('../config/database');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Account = require('../src/models/account');
const Patient = require('../src/models/patient');
const Role = require('../src/models/role');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());
app.use('/accounts', accountRoutes);

describe('Register Tests', () => {
  const existingEmail = 'exist.register@example.com';
  const newEmail = 'new.register@example.com';

  beforeAll(async () => {
    await database.connect();

    // ensure patient role exists
    let patientRole = await Role.findOne({ name: 'patient' });
    if (!patientRole) {
      patientRole = await Role.create({ name: 'patient', description: 'Patient role' });
    }

    // create an account to test duplicate email
    const hashedPassword = await bcrypt.hash('password123', 10);
    await Account.create({
      email: existingEmail,
      password: hashedPassword,
      roleId: patientRole._id,
      status: 'active',
      deleted: false
    });
  });

  afterAll(async () => {
    await Account.deleteMany({ email: { $in: [existingEmail, newEmail] } });
    await Patient.deleteMany({ name: { $in: ['New Register User'] } });
    await database.disconnect();
  });

  it('đăng ký thành công', async () => {
    const res = await request(app)
      .post('/accounts/register')
      .send({
        fullName: 'New Register User',
        email: newEmail,
        password: 'password123',
        phone: '0123456789',
        dob: '1990-01-01',
        gender: 'male',
        address: 'Hanoi'
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Đăng ký thành công!');
    expect(res.body.accountId).toBeDefined();
  });

  it('fullName trống', async () => {
    const res = await request(app)
      .post('/accounts/register')
      .send({
        fullName: '',
        email: 'f1@example.com',
        password: 'password123'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Vui lòng nhập họ và tên');
  });

  it('email trống', async () => {
    const res = await request(app)
      .post('/accounts/register')
      .send({
        fullName: 'User',
        email: '',
        password: 'password123'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Vui lòng nhập email');
  });

  it('email không hợp lệ', async () => {
    const res = await request(app)
      .post('/accounts/register')
      .send({
        fullName: 'User',
        email: 'invalid-email',
        password: 'password123'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email không hợp lệ');
  });

  it('password trống', async () => {
    const res = await request(app)
      .post('/accounts/register')
      .send({
        fullName: 'User',
        email: 'pempty@example.com',
        password: ''
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Vui lòng nhập mật khẩu');
  });

  it('password quá ngắn', async () => {
    const res = await request(app)
      .post('/accounts/register')
      .send({
        fullName: 'User',
        email: 'pshort@example.com',
        password: '123'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Mật khẩu phải ít nhất 6 ký tự!');
  });

  it('email đã tồn tại', async () => {
    const res = await request(app)
      .post('/accounts/register')
      .send({
        fullName: 'User',
        email: existingEmail,
        password: 'password123'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email đã tồn tại!');
  });
});
