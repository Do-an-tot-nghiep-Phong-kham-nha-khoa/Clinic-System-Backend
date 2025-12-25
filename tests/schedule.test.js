require("dotenv").config();
const request = require("supertest");
const express = require("express");
const database = require("../config/database");
const scheduleRoutes = require("../src/routes/scheduleRoutes");
const Schedule = require("../src/models/schedule");
const Doctor = require("../src/models/doctor");
const Account = require("../src/models/account");
const Specialty = require("../src/models/specialty");
const bcrypt = require("bcryptjs");

// Setup Express app
const app = express();
app.use(express.json());
app.use("/api/schedules", scheduleRoutes);

describe("Schedule Tests", () => {
  let testDoctorId;
  let testAccountId;
  let testSpecialtyId;
  let createdScheduleId;

  beforeAll(async () => {
    await database.connect();

    // Tạo test specialty
    const specialty = await Specialty.create({
      name: "Test Specialty - Nha Khoa",
      description: "Chuyên khoa nha khoa test",
    });
    testSpecialtyId = specialty._id;

    // Tạo test account
    const hashedPassword = await bcrypt.hash("test123456", 10);
    const account = await Account.create({
      email: "testdoctor.schedule@example.com",
      password: hashedPassword,
      status: "active",
    });
    testAccountId = account._id;

    // Tạo test doctor
    const doctor = await Doctor.create({
      accountId: testAccountId,
      name: "Dr. Test Schedule",
      specialtyId: testSpecialtyId,
      phone: "0123456789",
      experience: 5,
      bio: "Test doctor for schedule testing",
    });
    testDoctorId = doctor._id;
  });

  afterAll(async () => {
    // Clean up all test data
    await Schedule.deleteMany({ doctor_id: testDoctorId });
    await Doctor.findByIdAndDelete(testDoctorId);
    await Account.findByIdAndDelete(testAccountId);
    await Specialty.findByIdAndDelete(testSpecialtyId);
    await database.disconnect();
  });

  // Test 1: THÊM LỊCH LÀM VIỆC HỢP LỆ
  it("TC001. Thêm lịch làm việc cho bác sĩ hợp lệ", async () => {
    // Tạo ngày trong tương lai (ngày mai)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const newSchedule = {
      doctor_id: testDoctorId,
      date: tomorrow.toISOString(),
      timeSlots: [
        { startTime: "09:00", endTime: "09:30", isBooked: false },
        { startTime: "09:30", endTime: "10:00", isBooked: false },
        { startTime: "10:00", endTime: "10:30", isBooked: false },
        { startTime: "14:00", endTime: "14:30", isBooked: false },
        { startTime: "14:30", endTime: "15:00", isBooked: false },
      ],
    };

    const res = await request(app).post("/api/schedules").send(newSchedule);

    expect(res.status).toBe(201);
    expect(res.body.schedule).toHaveProperty("_id");

    // Lưu ID để dùng cho các test sau
    createdScheduleId = res.body.schedule._id;
  });

  // Test 2: THÊM LỊCH LÀM VIỆC KHÔNG HỢP LỆ (NGÀY TRONG QUÁ KHỨ)
  it("TC002. Thêm lịch làm việc cho bác sĩ không hợp lệ (ngày trong quá khứ)", async () => {
    // Tạo ngày trong quá khứ (hôm qua)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const invalidSchedule = {
      doctor_id: testDoctorId,
      date: yesterday.toISOString(),
      timeSlots: [
        { startTime: "09:00", endTime: "09:30", isBooked: false },
        { startTime: "09:30", endTime: "10:00", isBooked: false },
      ],
    };

    const res = await request(app).post("/api/schedules").send(invalidSchedule);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Cannot create schedule for past dates");
  });

  // Test 3: THÊM LỊCH LÀM VIỆC KHÔNG HỢP LỆ (NGÀY ĐÃ CÓ LỊCH)
  it("TC003. Thêm lịch làm việc cho bác sĩ không hợp lệ (ngày đã có lịch)", async () => {
    // Sử dụng cùng ngày với test 1 (ngày mai)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const duplicateSchedule = {
      doctor_id: testDoctorId,
      date: tomorrow.toISOString(),
      timeSlots: [
        { startTime: "11:00", endTime: "11:30", isBooked: false },
        { startTime: "11:30", endTime: "12:00", isBooked: false },
      ],
    };

    const res = await request(app)
      .post("/api/schedules")
      .send(duplicateSchedule);

    expect(res.status).toBe(409);
  });

  // Test 4: CẬP NHẬT KHUNG GIỜ HỢP LỆ
  it("TC004. Cập nhật khung giờ hợp lệ", async () => {
    // Lấy schedule vừa tạo để có slot ID
    const schedule = await Schedule.findById(createdScheduleId);
    expect(schedule).toBeTruthy();
    expect(schedule.timeSlots.length).toBeGreaterThan(0);

    const firstSlot = schedule.timeSlots[0];
    const slotId = firstSlot._id;

    // Cập nhật slot thành isBooked = true
    const updateData = {
      isBooked: true,
    };

    const res = await request(app)
      .put(`/api/schedules/slot/${slotId}`)
      .send(updateData);

    expect(res.status).toBe(200);

    // Verify trong database
    const updatedSchedule = await Schedule.findById(createdScheduleId);
    const updatedSlot = updatedSchedule.timeSlots.id(slotId);
    expect(updatedSlot.isBooked).toBe(true);
  });

  // Test 5: XOÁ LỊCH LÀM VIỆC ĐÃ TẠO
  it("TC005. Xoá lịch làm việc đã tạo", async () => {
    const res = await request(app).delete(
      `/api/schedules/${createdScheduleId}`
    );
    expect(res.status).toBe(200);

    // Verify lịch đã bị xoá
    const deletedSchedule = await Schedule.findById(createdScheduleId);
    expect(deletedSchedule).toBeNull();
  });
});
