const mongoose = require("mongoose");

const treatmentSchema = new mongoose.Schema(
  {
    healthProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthProfile",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
    treatmentDate: { type: Date, required: true },
    diagnosis: { type: String, required: true },
    laborder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabOrder",
    },
    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
    },
    bloodPressure: { type: String },
    heartRate: { type: Number },
    temperature: { type: Number },
    symptoms: { type: String },
    totalCost: { type: Number, required: true },

    // ========== SNAPSHOT FIELDS ==========
    // Snapshot của HealthProfile (lưu thông tin bệnh nhân tại thời điểm khám)
    healthProfileSnapshot: {
      ownerId: { type: mongoose.Schema.Types.ObjectId },
      ownerModel: { type: String, enum: ["Patient", "FamilyMember"] },
      ownerName: { type: String },
      ownerDob: { type: Date },
      ownerPhone: { type: String },
      ownerGender: { type: String },
      bloodType: { type: String },
      allergies: [String],
      chronicConditions: [String],
    },

    // Snapshot của Appointment
    appointmentSnapshot: {
      appointmentDate: { type: Date },
      timeSlot: { type: String },
      reason: { type: String },
    },

    // Snapshot của Doctor
    doctorSnapshot: {
      name: { type: String },
      phone: { type: String },
      specialtyId: { type: mongoose.Schema.Types.ObjectId },
      specialtyName: { type: String },
    },

    // Snapshot của LabOrder
    labOrderSnapshot: {
      testTime: { type: Date },
      totalPrice: { type: Number },
      items: [
        {
          serviceId: { type: mongoose.Schema.Types.ObjectId },
          serviceName: { type: String },
          quantity: { type: Number },
          price: { type: Number },
          description: { type: String },
        },
      ],
    },

    // Snapshot của Prescription
    prescriptionSnapshot: {
      created_at: { type: Date },
      totalPrice: { type: Number },
      items: [
        {
          medicineId: { type: mongoose.Schema.Types.ObjectId },
          medicineName: { type: String },
          quantity: { type: Number },
          dosage: { type: String },
          frequency: { type: String },
          duration: { type: String },
          instruction: { type: String },
          unit: { type: String },
          manufacturer: { type: String },
          price: { type: Number },
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Treatment", treatmentSchema, "treatments");
