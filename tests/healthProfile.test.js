const request = require('supertest');
const express = require('express');
const healthProfileRoutes = require('../src/routes/healthProfileRoutes');
const database = require('../config/database');
const HealthProfile = require('../src/models/healthProfile');
const FamilyMember = require('../src/models/familyMember');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = express();
app.use(express.json());
app.use('/health-profiles', healthProfileRoutes);

// allow longer DB ops
jest.setTimeout(30000);

describe('HealthProfile Controller', () => {
  const patientId = new mongoose.Types.ObjectId();
  let familyMemberId;

  beforeAll(async () => {
    // start in-memory mongo and point the DB helper to it
    await database.connect();
    // create a family member linked to patientId
    const fm = await FamilyMember.create({
      bookerId: patientId,
      name: 'Test FM',
      relationship: 'con',
      phone: '0900000000'
    });
    familyMemberId = fm._id;
  });

  afterAll(async () => {
    // cleanup
    await HealthProfile.deleteMany({ ownerId: { $in: [patientId, familyMemberId] } });
    await FamilyMember.deleteMany({ _id: familyMemberId });
    await database.disconnect();
    if (global.__MONGOD__) await global.__MONGOD__.stop();
  });

  it('tạo health profile cho patient thành công', async () => {
    const res = await request(app)
      .post(`/health-profiles/patient/${patientId}`)
      .send({
        height: 170,
        weight: 65,
        bloodType: 'A'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('ownerModel', 'Patient');
    expect(String(res.body.ownerId)).toBe(String(patientId));
  });

  it('không chấp nhận ownerModel không hợp lệ', async () => {
    const res = await request(app)
      .post(`/health-profiles/unknown/${patientId}`)
      .send({ height: 160 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid ownerModel (expected: patient|familyMember)');
  });

  it('không chấp nhận ownerId không hợp lệ', async () => {
    const res = await request(app)
      .post('/health-profiles/patient/123')
      .send({ height: 160 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid ownerId');
  });

  it('không cho phép tạo trùng health profile', async () => {
    // first create
    await HealthProfile.create({ ownerModel: 'Patient', ownerId: patientId });

    const res = await request(app)
      .post(`/health-profiles/patient/${patientId}`)
      .send({ height: 170 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Health profile already exists');
  });

  it('lấy tất cả health profiles cho patient bao gồm người nhà', async () => {
    // create profile for family member
    await HealthProfile.create({ ownerModel: 'FamilyMember', ownerId: familyMemberId });

    const res = await request(app).get(`/health-profiles/all/${patientId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // should contain at least one Patient or FamilyMember profile
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('cập nhật health profile theo id', async () => {
    const p = await HealthProfile.create({ ownerModel: 'Patient', ownerId: new mongoose.Types.ObjectId(), height: 150 });
    const res = await request(app)
      .patch(`/health-profiles/profile/${p._id}`)
      .send({ height: 180 });

    expect(res.status).toBe(200);
    expect(res.body.height).toBe(180);
    await HealthProfile.findByIdAndDelete(p._id);
  });

  it('xóa health profile theo id', async () => {
    const p = await HealthProfile.create({ ownerModel: 'Patient', ownerId: new mongoose.Types.ObjectId() });
    const res = await request(app).delete(`/health-profiles/profile/${p._id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Health profile deleted successfully');
  });
});
