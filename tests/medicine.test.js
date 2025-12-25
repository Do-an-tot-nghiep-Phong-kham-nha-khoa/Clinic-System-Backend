require("dotenv").config();
const request = require("supertest");
const express = require("express");
const database = require("../config/database");
const medicineRoutes = require("../src/routes/medicineRoutes");
const Medicine = require("../src/models/medicine");

// Setup Express app
const app = express();
app.use(express.json());
app.use("/api/medicines", medicineRoutes);

describe("Medicine Tests", () => {
  let createdMedicineId;

  beforeAll(async () => {
    await database.connect();
  });

  afterAll(async () => {
    // Clean up all test medicines
    await Medicine.deleteMany({
      name: { $regex: /^Test Medicine/i },
    });
    await database.disconnect();
  });

  // Test 1: THÊM MỚI THUỐC THÀNH CÔNG
  it("TC001. Thêm mới thuốc thành công", async () => {
    const newMedicine = {
      name: "Test Medicine - Paracetamol 500mg",
      price: 5000,
      quantity: 1000,
      dosageForm: "Viên nén",
      manufacturer: "Traphaco",
      unit: "Viên",
      expiryDate: new Date("2026-12-31"),
    };

    const res = await request(app).post("/api/medicines").send(newMedicine);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("_id");
    // Lưu ID để dùng cho các test sau
    createdMedicineId = res.body._id;
  });

  // Test 2: THÊM MỚI THUỐC KHÔNG THÀNH CÔNG
  it("TC002. Dữ liệu nhập không hợp lệ", async () => {
    const invalidMedicine = {
      name: "Test Medicine - Invalid",
      price: -5000,
      quantity: -100,
      expiryDate: new Date("2016-12-31"),
    };

    const res = await request(app).post("/api/medicines").send(invalidMedicine);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
  });

  // ==================== TEST 3: CẬP NHẬT THUỐC THÀNH CÔNG ====================
  it("TC003. Cập nhật thuốc thành công", async () => {
    const updateData = {
      name: "Test Medicine - Paracetamol 500mg (Updated)",
      price: 6000,
      quantity: 1500,
      dosageForm: "Viên nang",
      manufacturer: "DHG Pharma",
      unit: "Viên",
      expiryDate: new Date("2027-12-31"),
    };

    const res = await request(app)
      .put(`/api/medicines/${createdMedicineId}`)
      .send(updateData);

    expect(res.status).toBe(200);
  });

  // TEST 4: CẬP NHẬT THUỐC KHÔNG THÀNH CÔNG
  it("TC004. ID không tồn tại", async () => {
    const fakeId = "507f1f77bcf86cd799439011"; // Valid ObjectId but not exists
    const updateData = {
      name: "Updated Medicine",
      price: 10000,
    };

    const res = await request(app)
      .put(`/api/medicines/${fakeId}`)
      .send(updateData);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Medicine not found");
  });
  // Test 5: XÓA THUỐC THÀNH CÔNG
  it("TC005. Xóa thuốc thành công", async () => {
    const res = await request(app).delete(
      `/api/medicines/${createdMedicineId}`
    );

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Medicine deleted");

    // Verify thuốc đã bị xóa
    const checkRes = await request(app).get(
      `/api/medicines/${createdMedicineId}`
    );
    expect(checkRes.status).toBe(404);
  });
});
