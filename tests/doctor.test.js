require("dotenv").config();
const request = require("supertest");
const express = require("express");
const database = require("../config/database");
const doctorRoutes = require("../src/routes/doctorRoutes");
const Doctor = require("../src/models/doctor");
const Account = require("../src/models/account");
const Role = require("../src/models/role");
const Specialty = require("../src/models/specialty");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

// Setup Express app
const app = express();
app.use(express.json());
app.use("/api/doctors", doctorRoutes);

describe("Doctor Controller Tests", () => {
  let createdDoctorId;
  let doctorRole;
  let specialty;
  jest.setTimeout(30000);

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri; // Set the URI for the in-memory database
    await database.connect();

    // Create a doctor role
    doctorRole = await Role.findOne({ name: "doctor" });
    if (!doctorRole) {
      doctorRole = await Role.create({ name: "doctor", description: "Doctor role" });
    }

    // Create a specialty
    specialty = await Specialty.findOne({ name: "Dentistry" });
    if (!specialty) {
      specialty = await Specialty.create({ name: "Dentistry" });
    }
  });

  afterAll(async () => {
    await Doctor.deleteMany({ name: { $regex: /^Test Doctor/i } });
    await Account.deleteMany({ email: { $regex: /testdoctor/i } });
    // delte specialty
    await Specialty.deleteMany({ name: "Dentistry" });
    await database.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it("TC001. Create a new doctor", async () => {
    const newDoctor = {
      name: "Test Doctor - John Doe",
      specialtyName: specialty.name,
      phone: "123456789",
      email: "testdoctor@example.com",
      password: "password123",
      experience: 5,
    };

    const res = await request(app).post("/api/doctors").send(newDoctor);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("data");
    createdDoctorId = res.body.data._id;
  });
  it("TC002. Create a new doctor with existing email", async () => {
    const newDoctor = {
      name: "Test Doctor - Jane Doe",
      specialtyName: specialty.name,
      phone: "987654321",
      email: "testdoctor@example.com",
      password: "password123",
      experience: 3,
    };
    const res = await request(app).post("/api/doctors").send(newDoctor);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message", "Email đã được sử dụng");
  });
  
  it("TC002. Get all doctors", async () => {
    const res = await request(app).get("/api/doctors");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it("TC003. Get doctor by ID", async () => {
    const res = await request(app).get(`/api/doctors/${createdDoctorId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data.doctor).toHaveProperty("_id", createdDoctorId);
  });

  it("TC004. Update doctor information", async () => {
    const updateData = { experience: 10 };

    const res = await request(app).put(`/api/doctors/${createdDoctorId}`).send(updateData);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("experience", 10);
  });

  it("TC005. Delete doctor", async () => {
    const res = await request(app).delete(`/api/doctors/${createdDoctorId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "Xóa bác sĩ và dữ liệu liên quan thành công");
  });

  it("TC006. Get doctors by IDs", async () => {
    const res = await request(app).post("/api/doctors/ids").send({ ids: [createdDoctorId] });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data[0]).toHaveProperty("_id", createdDoctorId);
  });

  it("TC007. Get doctors by specialty", async () => {
    const res = await request(app).get(`/api/doctors/specialty/${specialty._id}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it("TC008. Search doctors", async () => {
    const res = await request(app).get(`/api/doctors/search?query=John`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it("TC009. Get doctor by account ID", async () => {
    const doctor = await Doctor.findById(createdDoctorId);
    const res = await request(app).get(`/api/doctors/account/${doctor.accountId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("_id", createdDoctorId);
  });

  it("TC010. Update doctor bio", async () => {
    const updateData = { bio: "Experienced dentist with 10 years of practice." };

    const res = await request(app).patch(`/api/doctors/${createdDoctorId}/bio`).send(updateData);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("bio", updateData.bio);
  });
});
