require("dotenv").config();
const request = require("supertest");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");
const database = require("../config/database");
const specialtyRoutes = require("../src/routes/specialtyRoutes");
const Specialty = require("../src/models/specialty");

// Setup Express app
const app = express();
app.use(express.json());
app.use("/api/specialties", specialtyRoutes);

describe("Specialty Controller Tests", () => {
  let mongoServer;
  let createdSpecialtyId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
    await database.connect();
  });

  afterAll(async () => {
    await Specialty.deleteMany({});
    await database.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it("TC001. Create a new specialty", async () => {
    const newSpecialty = {
      name: "Dentistry",
      description: "Specialty in dental care",
    };

    const res = await request(app).post("/api/specialties").send(newSpecialty);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("data");
    createdSpecialtyId = res.body.data._id;
  });

  it("TC002. Get all specialties", async () => {
    const res = await request(app).get("/api/specialties");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it("TC003. Get specialty by ID", async () => {
    const res = await request(app).get(`/api/specialties/${createdSpecialtyId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("_id", createdSpecialtyId);
  });

  it("TC004. Update specialty", async () => {
    const updateData = { description: "Updated specialty description" };

    const res = await request(app).put(`/api/specialties/${createdSpecialtyId}`).send(updateData);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("description", updateData.description);
  });

  it("TC005. Delete specialty", async () => {
    const res = await request(app).delete(`/api/specialties/${createdSpecialtyId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "Specialty deleted successfully");
  });
});