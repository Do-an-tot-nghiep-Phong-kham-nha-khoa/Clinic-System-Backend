const request = require('supertest');
const express = require('express');
const accountRoutes = require('../src/routes/accountRoutes');
const database = require('../config/database');
const Account = require('../src/models/account');
const Role = require('../src/models/role');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());
app.use('/accounts', accountRoutes);

describe('Login Tests', () => {
  let patientRole;

  beforeAll(async () => {
    await database.connectMockDB();

    patientRole = await Role.findOne({ name: 'patient' });
    if (!patientRole) {
      patientRole = await Role.create({
        name: 'patient',
        description: 'Patient role'
      });
    }

    const hashedPassword = await bcrypt.hash('password123', 10);
    await Account.create({
      email: 'test@example.com',
      password: hashedPassword,
      roleId: patientRole._id,
      status: 'active',
      deleted: false
    });
  });

  afterAll(async () => {
    await Account.deleteMany({ email: 'test@example.com' });
  });

  it('đăng nhập thành công', async () => {
    const res = await request(app)
      .post('/accounts/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Đăng nhập thành công!');
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('email không hợp lệ (không có @)', async () => {
    const res = await request(app)
      .post('/accounts/login')
      .send({
        email: 'testexample.com',
        password: 'password123'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email không hợp lệ');
  });

  it('email trống', async () => {
    const res = await request(app)
      .post('/accounts/login')
      .send({
        email: '',
        password: 'password123'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email không hợp lệ');
  });

  it('mật khẩu trống', async () => {
    const res = await request(app)
      .post('/accounts/login')
      .send({
        email: 'test@example.com',
        password: ''
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Mật khẩu phải có ít nhất 6 ký tự');
  });

  it('mật khẩu quá ngắn', async () => {
    const res = await request(app)
      .post('/accounts/login')
      .send({
        email: 'test@example.com',
        password: '123'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Mật khẩu phải có ít nhất 6 ký tự');
  });

  it('email không tồn tại', async () => {
    const res = await request(app)
      .post('/accounts/login')
      .send({
        email: 'notfound@example.com',
        password: 'password123'
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Email không tồn tại!');
  });

  it('sai mật khẩu', async () => {
    const res = await request(app)
      .post('/accounts/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Sai mật khẩu!');
  });
});
