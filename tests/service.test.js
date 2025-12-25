require("dotenv").config();
const request = require("supertest");
const express = require("express");
const database = require("../config/database");
const serviceRoutes = require("../src/routes/serviceRoutes");
const Service = require("../src/models/service");

// Setup Express app
const app = express();
app.use(express.json());
app.use("/api/services", serviceRoutes);

describe("Service Tests", () => {
  let createdServiceId;

  beforeAll(async () => {
    await database.connect();
  });

  afterAll(async () => {
    // Clean up all test services
    await Service.deleteMany({
      name: { $regex: /^Test Service/i },
    });
    await database.disconnect();
  });

  // Test 1: THÊM MỚI SERVICE THÀNH CÔNG
  it("TC001. Thêm mới service thành công", async () => {
    const newService = {
      name: "Test Service - Khám tổng quát",
      price: 200000,
      description: "Dịch vụ khám sức khỏe tổng quát định kỳ",
    };

    const res = await request(app).post("/api/services").send(newService);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("_id");

    // Lưu ID để dùng cho các test sau
    createdServiceId = res.body._id;
  });

  // Test 2: THÊM MỚI SERVICE KHÔNG THÀNH CÔNG
  it("TC002. Thiếu tên service (name)", async () => {
    const invalidService = {
      // Thiếu name
      price: 200000,
      description: "Dịch vụ test",
    };

    const res = await request(app).post("/api/services").send(invalidService);

    expect(res.status).toBe(400);
  });

  // Test 3: CẬP NHẬT SERVICE THÀNH CÔNG
  it("TC003. Cập nhật service thành công", async () => {
    const updateData = {
      name: "Test Service - Khám tổng quát (Updated)",
      price: 250000,
      description: "Dịch vụ khám sức khỏe tổng quát định kỳ - Cập nhật",
    };

    const res = await request(app)
      .put(`/api/services/${createdServiceId}`)
      .send(updateData);

    expect(res.status).toBe(200);
  });

  // Test 4: CẬP NHẬT SERVICE KHÔNG THÀNH CÔNG

  it("TC004. ID không tồn tại", async () => {
    const fakeId = "507f1f77bcf86cd799439011"; // Valid ObjectId but not exists
    const updateData = {
      name: "Updated Service",
      price: 300000,
    };

    const res = await request(app)
      .put(`/api/services/${fakeId}`)
      .send(updateData);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Service not found");
  });

  // Test 5: XÓA SERVICE THÀNH CÔNG
  it("TC005. Xóa service thành công", async () => {
    const res = await request(app).delete(`/api/services/${createdServiceId}`);

    expect(res.status).toBe(200);

    // Verify service đã bị xóa
    const checkRes = await request(app).get(
      `/api/services/${createdServiceId}`
    );
    expect(checkRes.status).toBe(404);
  });
});
