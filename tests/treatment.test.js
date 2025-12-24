require("dotenv").config();
const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const database = require("../config/database");
const bcrypt = require("bcrypt");

// Import routes
const labOrderRoutes = require("../src/routes/labOrderRoutes");
const prescriptionRoutes = require("../src/routes/prescriptionRoutes");
const treatmentRoutes = require("../src/routes/treatmentRoutes");

// Import models
const LabOrder = require("../src/models/labOrder");
const Prescription = require("../src/models/prescription");
const Treatment = require("../src/models/treatment");
const Invoice = require("../src/models/invoice");
const Service = require("../src/models/service");
const Medicine = require("../src/models/medicine");
const HealthProfile = require("../src/models/healthProfile");
const Doctor = require("../src/models/doctor");
const Patient = require("../src/models/patient");
const Account = require("../src/models/account");
const Role = require("../src/models/role");

// Setup Express app
const app = express();
app.use(express.json());
app.use("/api/laborders", labOrderRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/treatments", treatmentRoutes);

describe("Treatment, LabOrder & Prescription Tests", () => {
  let testService;
  let testMedicine;
  let testHealthProfile;
  let testDoctor;
  let testPatient;
  let doctorRole;
  let patientRole;

  beforeAll(async () => {
    await database.connect();

    // Tạo roles
    patientRole = await Role.findOne({ name: "patient" });
    if (!patientRole) {
      patientRole = await Role.create({
        name: "patient",
        description: "Patient role",
      });
    }

    doctorRole = await Role.findOne({ name: "doctor" });
    if (!doctorRole) {
      doctorRole = await Role.create({
        name: "doctor",
        description: "Doctor role",
      });
    }

    // Tạo test account và patient
    const hashedPassword = await bcrypt.hash("testpass123", 10);
    const testAccount = await Account.create({
      email: "testpatient@clinic.com",
      password: hashedPassword,
      roleId: patientRole._id,
      status: "active",
      deleted: false,
    });
    testPatient = await Patient.create({
      name: "Nguyễn Văn Test",
      dob: new Date("1990-01-01"),
      gender: "male",
      phone: "0123456789",
      address: "123 Test Street",
      accountId: testAccount._id,
    });

    // Tạo test doctor account và doctor
    const doctorAccount = await Account.create({
      email: "testdoctor@clinic.com",
      password: hashedPassword,
      roleId: doctorRole._id,
      status: "active",
      deleted: false,
    });

    testDoctor = await Doctor.create({
      name: "BS. Test Doctor",
      dob: new Date("1980-01-01"),
      gender: "male",
      phone: "0987654321",
      email: "testdoctor@clinic.com",
      specialtyId: new mongoose.Types.ObjectId(),
      accountId: doctorAccount._id,
    });

    // Tạo test health profile
    testHealthProfile = await HealthProfile.create({
      ownerId: testPatient._id,
      ownerModel: "Patient",
      bloodType: "O",
      allergies: [],
      medicalHistory: [],
    });

    // Tạo test service
    testService = await Service.create({
      name: "Xét nghiệm máu tổng quát",
      price: 200000,
      description: "Xét nghiệm máu cơ bản",
    });

    // Tạo test medicine
    testMedicine = await Medicine.create({
      name: "Paracetamol 500mg",
      price: 5000,
      quantity: 1000,
      dosageForm: "Viên nén",
      manufacturer: "Traphaco",
      unit: "Viên",
      expiryDate: new Date("2026-12-31"),
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testHealthProfile) {
      await LabOrder.deleteMany({ healthProfile_id: testHealthProfile._id });
      await Prescription.deleteMany({
        healthProfile_id: testHealthProfile._id,
      });
      await Treatment.deleteMany({ healthProfile: testHealthProfile._id });
      await Invoice.deleteMany({ healthProfile_id: testHealthProfile._id });
      await HealthProfile.findByIdAndDelete(testHealthProfile._id);
    }

    if (testPatient) await Patient.findByIdAndDelete(testPatient._id);
    if (testDoctor) await Doctor.findByIdAndDelete(testDoctor._id);
    if (testService) await Service.findByIdAndDelete(testService._id);
    if (testMedicine) await Medicine.findByIdAndDelete(testMedicine._id);

    await Account.deleteMany({
      email: { $in: ["testpatient@clinic.com", "testdoctor@clinic.com"] },
    });

    await database.disconnect();
  });

  // ==================== LAB ORDER TESTS ====================

  it("TC001. Tạo lab order hợp lệ", async () => {
    const res = await request(app)
      .post("/api/laborders")
      .send({
        testTime: new Date().toISOString(),
        healthProfile_id: testHealthProfile._id.toString(),
        items: [
          {
            serviceId: testService._id.toString(),
            quantity: 1,
            description: "Test mô tả",
          },
        ],
      });

    expect(res.status).toBe(201);
  });

  it("TC002. Tạo lab order không hợp lệ (rỗng service)", async () => {
    const res = await request(app).post("/api/laborders").send({
      testTime: new Date().toISOString(),
      healthProfile_id: testHealthProfile._id.toString(),
      items: [],
    });

    expect(res.status).toBe(400);
  });

  // ==================== PRESCRIPTION TESTS ====================

  it("TC003. Tạo prescription hợp lệ", async () => {
    const res = await request(app)
      .post("/api/prescriptions")
      .send({
        createAt: new Date().toISOString(),
        healthProfile_id: testHealthProfile._id.toString(),
        items: [
          {
            medicineId: testMedicine._id.toString(),
            quantity: 10,
            dosage: "500mg",
            frequency: "Ngày 3 lần",
            duration: "7 ngày",
            instruction: "Uống sau khi ăn",
          },
        ],
      });

    expect(res.status).toBe(201);
  });

  it("TC004. Tạo prescription không hợp lệ (rỗng medicine)", async () => {
    const res = await request(app).post("/api/prescriptions").send({
      createAt: new Date().toISOString(),
      healthProfile_id: testHealthProfile._id.toString(),
      items: [],
    });

    expect(res.status).toBe(400);
  });

  // ==================== TREATMENT & INVOICE TESTS ====================

  it("TC005. Tạo treatment và invoice thành công", async () => {
    // Tạo lab order và prescription
    const testLabOrder = await LabOrder.create({
      testTime: new Date(),
      totalPrice: 200000,
      healthProfile_id: testHealthProfile._id,
      items: [
        {
          serviceId: testService._id,
          quantity: 1,
          description: "Test lab order",
        },
      ],
    });

    const testPrescription = await Prescription.create({
      created_at: new Date(),
      totalPrice: 50000,
      healthProfile_id: testHealthProfile._id,
      items: [
        {
          medicineId: testMedicine._id,
          quantity: 10,
          dosage: "500mg",
          frequency: "Ngày 3 lần",
          duration: "7 ngày",
          instruction: "Uống sau khi ăn",
        },
      ],
    });

    const res = await request(app).post("/api/treatments").send({
      healthProfile: testHealthProfile._id.toString(),
      doctor: testDoctor._id.toString(),
      treatmentDate: new Date().toISOString(),
      diagnosis: "Cảm cúm thông thường",
      laborder: testLabOrder._id.toString(),
      prescription: testPrescription._id.toString(),
      bloodPressure: "120/80",
      heartRate: 75,
      temperature: 37.5,
      symptoms: "Sốt nhẹ, ho",
    });

    expect(res.status).toBe(201);

    // Clean up
    await Treatment.findByIdAndDelete(res.body.data._id);
    await Invoice.findByIdAndDelete(res.body.invoice._id);
    await LabOrder.findByIdAndDelete(testLabOrder._id);
    await Prescription.findByIdAndDelete(testPrescription._id);
  });

  it("TC006. Tạo treatment thiếu diagnosis", async () => {
    const res = await request(app).post("/api/treatments").send({
      healthProfile: testHealthProfile._id.toString(),
      doctor: testDoctor._id.toString(),
      treatmentDate: new Date().toISOString(),
    });

    expect(res.status).toBe(400);
  });
});
