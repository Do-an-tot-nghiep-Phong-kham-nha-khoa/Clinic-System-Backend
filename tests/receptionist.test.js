require("dotenv").config();
const request = require("supertest");
const express = require("express");
const database = require("../config/database");
const receptionistRoutes = require("../src/routes/receptionistRoutes");
const Receptionist = require("../src/models/receptionist");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;
const app = express();
app.use(express.json());
app.use("/api/receptionists", receptionistRoutes);

describe("Receptionist Controller Tests", () => {
  let createdReceptionistId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
    await database.connect();
  });

  afterAll(async () => {
    await Receptionist.deleteMany({});
    await database.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it("TC001. Create a new receptionist", async () => {
    const newReceptionist = {
      name: "Test Receptionist",
      email: "testreceptionist@example.com",
      phone: "123456789",
    };

    const res = await request(app).post("/api/receptionists").send(newReceptionist);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("data");
    createdReceptionistId = res.body.data._id;
  });

  it("TC002. Get all receptionists", async () => {
    const res = await request(app).get("/api/receptionists");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it("TC003. Get receptionist by ID", async () => {
    const res = await request(app).get(`/api/receptionists/${createdReceptionistId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("_id", createdReceptionistId);
  });

  it("TC004. Update receptionist information", async () => {
    const updateData = { phone: "987654321" };

    const res = await request(app).put(`/api/receptionists/${createdReceptionistId}`).send(updateData);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("phone", "987654321");
  });

  it("TC005. Delete receptionist", async () => {
    const res = await request(app).delete(`/api/receptionists/${createdReceptionistId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "Receptionist deleted successfully");
  });

  it("TC006. Fail to create receptionist with missing fields", async () => {
    const incompleteReceptionist = {
      name: "Incomplete Receptionist",
    };

    const res = await request(app).post("/api/receptionists").send(incompleteReceptionist);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("TC007. Fail to get non-existent receptionist", async () => {
    const res = await request(app).get("/api/receptionists/nonexistentid");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Receptionist not found");
  });
});