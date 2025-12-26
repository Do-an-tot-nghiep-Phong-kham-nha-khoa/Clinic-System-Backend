require("dotenv").config();
const request = require("supertest");
const express = require("express");
const database = require("../config/database");
const patientRoutes = require("../src/routes/patientRoutes");
const Patient = require("../src/models/patient");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;
const app = express();
app.use(express.json());
app.use("/api/patients", patientRoutes);

describe("Patient Controller Tests", () => {
  let createdPatientId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
    await database.connect();
  });

  afterAll(async () => {
    await Patient.deleteMany({});
    await database.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it("TC001. Create a new patient", async () => {
    const newPatient = {
      name: "Test Patient",
      email: "testpatient@example.com",
      phone: "123456789",
    };

    const res = await request(app).post("/api/patients").send(newPatient);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("data");
    createdPatientId = res.body.data._id;
  });

  it("TC002. Get all patients", async () => {
    const res = await request(app).get("/api/patients");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it("TC003. Get patient by ID", async () => {
    const res = await request(app).get(`/api/patients/${createdPatientId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("_id", createdPatientId);
  });

  it("TC004. Update patient information", async () => {
    const updateData = { phone: "987654321" };

    const res = await request(app).put(`/api/patients/${createdPatientId}`).send(updateData);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("phone", "987654321");
  });

  it("TC005. Delete patient", async () => {
    const res = await request(app).delete(`/api/patients/${createdPatientId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "Patient deleted successfully");
  });

  it("TC006. Fail to create patient with missing fields", async () => {
    const incompletePatient = {
      name: "Incomplete Patient",
    };

    const res = await request(app).post("/api/patients").send(incompletePatient);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("TC007. Fail to get non-existent patient", async () => {
    const res = await request(app).get("/api/patients/nonexistentid");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Patient not found");
  });
});