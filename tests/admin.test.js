require("dotenv").config();
const request = require("supertest");
const express = require("express");
const database = require("../config/database");
const adminRoutes = require("../src/routes/adminRoutes");
const Admin = require("../src/models/admin");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;
const app = express();
app.use(express.json());
app.use("/api/admins", adminRoutes);

describe("Admin Controller Tests", () => {
  let createdAdminId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
    await database.connect();
  });

  afterAll(async () => {
    await Admin.deleteMany({});
    await database.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it("TC001. Create a new admin", async () => {
    const newAdmin = {
      name: "Test Admin",
      email: "testadmin@example.com",
      phone: "123456789",
    };

    const res = await request(app).post("/api/admins").send(newAdmin);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("data");
    createdAdminId = res.body.data._id;
  });

  it("TC002. Get all admins", async () => {
    const res = await request(app).get("/api/admins");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it("TC003. Get admin by ID", async () => {
    const res = await request(app).get(`/api/admins/${createdAdminId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("_id", createdAdminId);
  });

  it("TC004. Update admin information", async () => {
    const updateData = { phone: "987654321" };

    const res = await request(app).put(`/api/admins/${createdAdminId}`).send(updateData);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("phone", "987654321");
  });

  it("TC005. Delete admin", async () => {
    const res = await request(app).delete(`/api/admins/${createdAdminId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "Admin deleted successfully");
  });

  it("TC006. Fail to create admin with missing fields", async () => {
    const incompleteAdmin = {
      name: "Incomplete Admin",
    };

    const res = await request(app).post("/api/admins").send(incompleteAdmin);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("TC007. Fail to get non-existent admin", async () => {
    const res = await request(app).get("/api/admins/nonexistentid");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Admin not found");
  });
});