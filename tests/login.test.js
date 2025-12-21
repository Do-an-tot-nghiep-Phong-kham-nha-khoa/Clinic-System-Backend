const request = require('supertest');
const express = require('express');
const accountRoutes = require('../src/routes/accountRoutes');
const database = require('../config/database');
const Account = require('../src/models/account');
const Role = require('../src/models/role');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
app.use('/accounts', accountRoutes);

jest.setTimeout(10000); // Tăng thời gian chờ của Jest lên 10 giây

describe('Login Tests', () => {
  let testAccount;
  let patientRole;

  beforeAll(async () => {
    await database.connectMockDB();

    // Tạo role patient nếu chưa có
    patientRole = await Role.findOne({ name: 'patient' });
    if (!patientRole) {
      patientRole = new Role({ name: 'patient', description: 'Patient role' });
      await patientRole.save();
    }

    // Tạo account test
    const hashedPassword = await bcrypt.hash('password123', 10);
    testAccount = new Account({
      email: 'test@example.com',
      password: hashedPassword,
      roleId: patientRole._id,
      status: 'active'
    });
    await testAccount.save();
  });

  afterAll(async () => {
    // Dọn dẹp
    await Account.deleteMany({ email: 'test@example.com' });
    await mongoose.connection.close();
  });

  it('đăng nhập chuẩn - thành công', async () => {
    const response = await request(app)
      .post('/accounts/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Đăng nhập thành công!');
    expect(response.body.user).toHaveProperty('email', 'test@example.com');
  });

  it('email không hợp lệ - không có @', async () => {
    const response = await request(app)
      .post('/accounts/login')
      .send({
        email: 'testexample.com',
        password: 'password123'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Email không hợp lệ');
  });

  it('mật khẩu sai', async () => {
    const response = await request(app)
      .post('/accounts/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Sai mật khẩu!');
  });

  it('email không tồn tại', async () => {
    const response = await request(app)
      .post('/accounts/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'password123'
      });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Email không tồn tại!');
  });

  it('trống trường - email trống', async () => {
    const response = await request(app)
      .post('/accounts/login')
      .send({
        email: '',
        password: 'password123'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Vui lòng nhập email');
  });

  it('trống trường - mật khẩu trống', async () => {
    const response = await request(app)
      .post('/accounts/login')
      .send({
        email: 'test@example.com',
        password: ''
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Vui lòng nhập mật khẩu');
  });
});

