const Treatment = require("../models/treatment");
const Doctor = require("../models/doctor");
const Patient = require("../models/patient");
const Appointment = require("../models/appointment");
const FamilyMember = require("../models/familyMember");
const LabOrder = require("../models/labOrder");
const Prescription = require("../models/prescription");
const HealthProfile = require("../models/healthProfile");
const Invoice = require("../models/invoice");
const mongoose = require("mongoose");

const {
  getPagingParams,
  applyPagingAndSortingToQuery,
  buildMeta,
} = require("../helpers/query");

exports.createTreatment = async (req, res) => {
  try {
    const {
      healthProfile,
      doctor,
      appointment,
      treatmentDate,
      diagnosis,
      prescription,
      laborder,
      bloodPressure,
      heartRate,
      temperature,
      symptoms,
    } = req.body;

    // ✅ 1. Validate ObjectIds
    const validateId = (id, name) => {
      if (!mongoose.isValidObjectId(id)) {
        throw new Error(`Invalid ${name} ID`);
      }
    };

    if (!healthProfile || !doctor || !treatmentDate || !diagnosis) {
      throw new Error("Thiếu thông tin bắt buộc");
    }

    validateId(healthProfile, "HealthProfile");
    validateId(doctor, "Doctor");
    if (appointment) validateId(appointment, "Appointment");
    if (laborder) validateId(laborder, "LabOrder");
    if (prescription) validateId(prescription, "Prescription");

    // ✅ 2. Parallel queries
    const [hp, doctorDoc, appointmentDoc, labOrderDoc, prescriptionDoc] =
      await Promise.all([
        HealthProfile.findById(healthProfile),
        Doctor.findById(doctor).populate("specialtyId", "name"),
        appointment ? Appointment.findById(appointment) : null,
        laborder
          ? LabOrder.findById(laborder).populate(
              "items.serviceId",
              "name price"
            )
          : null,
        prescription
          ? Prescription.findById(prescription).populate(
              "items.medicineId",
              "name unit manufacturer price"
            )
          : null,
      ]);

    // ✅ 3. Early validation
    if (!hp) throw new Error("Không tìm thấy health profile");
    if (!doctorDoc) throw new Error("Không tìm thấy bác sĩ");

    // ✅ 4. Parallel owner + appointment update
    const ownerModelRef = hp.ownerModel === "Patient" ? Patient : FamilyMember;

    const ownerPromise = ownerModelRef
      .findById(hp.ownerId)
      .select("name dob phone gender");

    const updateAppointmentPromise = appointmentDoc
      ? Appointment.findByIdAndUpdate(appointment, { status: "completed" })
      : null;

    const [owner] = await Promise.all([ownerPromise, updateAppointmentPromise]);

    // ✅ 5. Build snapshots
    const healthProfileSnapshot = {
      ownerId: hp.ownerId,
      ownerModel: hp.ownerModel,
      ownerName: owner?.name || "",
      ownerDob: owner?.dob || null,
      ownerPhone: owner?.phone || "",
      ownerGender: owner?.gender || "",
      bloodType: hp.bloodType || "",
      allergies: hp.allergies || [],
      chronicConditions: hp.chronicConditions || [],
    };

    const doctorSnapshot = {
      name: doctorDoc.name || "",
      phone: doctorDoc.phone || "",
      specialtyId: doctorDoc.specialtyId?._id || null,
      specialtyName: doctorDoc.specialtyId?.name || "",
    };

    let appointmentSnapshot = null;
    if (appointmentDoc) {
      appointmentSnapshot = {
        appointmentDate: appointmentDoc.appointmentDate,
        timeSlot: appointmentDoc.timeSlot,
        reason: appointmentDoc.reason,
      };
    }

    let labOrderSnapshot = null;
    let labOrderPrice = 0;
    if (labOrderDoc) {
      labOrderPrice = labOrderDoc.totalPrice || 0;
      labOrderSnapshot = {
        testTime: labOrderDoc.testTime,
        totalPrice: labOrderDoc.totalPrice,
        items: labOrderDoc.items.map((item) => ({
          serviceId: item.serviceId?._id,
          serviceName: item.serviceId?.name || "",
          quantity: item.quantity,
          price: item.serviceId?.price || 0,
          description: item.description || "",
        })),
      };
    }

    let prescriptionSnapshot = null;
    let prescriptionPrice = 0;
    if (prescriptionDoc) {
      prescriptionPrice = prescriptionDoc.totalPrice || 0;
      prescriptionSnapshot = {
        created_at: prescriptionDoc.created_at,
        totalPrice: prescriptionDoc.totalPrice,
        items: prescriptionDoc.items.map((item) => ({
          medicineId: item.medicineId?._id,
          medicineName: item.medicineId?.name || "",
          quantity: item.quantity,
          dosage: item.dosage || "",
          frequency: item.frequency || "",
          duration: item.duration || "",
          instruction: item.instruction || "",
          unit: item.medicineId?.unit || "",
          manufacturer: item.medicineId?.manufacturer || "",
          price: item.medicineId?.price || 0,
        })),
      };
    }
    const totalCost = labOrderPrice + prescriptionPrice;

    // ✅ 6. Create Treatment first
    const savedTreatment = await Treatment.create({
      healthProfile,
      doctor,
      appointment,
      treatmentDate,
      diagnosis,
      laborder,
      prescription,
      bloodPressure,
      heartRate,
      temperature,
      symptoms,
      totalCost,
      healthProfileSnapshot,
      doctorSnapshot,
      appointmentSnapshot,
      labOrderSnapshot,
      prescriptionSnapshot,
    });

    // ✅ 7. Create Invoice with treatmentId (if needed)
    let createdInvoice = null;
    if (prescription || laborder) {
      const invoiceNumber = `INV${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 4)
        .toUpperCase()}`;

      createdInvoice = await Invoice.create({
        invoiceNumber,
        treatmentId: savedTreatment._id,
        totalPrice: totalCost,
        status: "Pending",
        healthProfile_id: healthProfile,
        issued_at: treatmentDate,
        prescriptionId: prescription || null,
        labOrderId: laborder || null,
      });
    }

    // ✅ 8. Response
    const responseData = {
      ...savedTreatment.toObject(),
      healthProfile: {
        _id: hp._id,
        ...healthProfileSnapshot,
      },
      doctor: {
        _id: doctorDoc._id,
        ...doctorSnapshot,
      },
      appointment: appointmentSnapshot
        ? {
            _id: appointmentDoc._id,
            ...appointmentSnapshot,
          }
        : null,
    };

    res.status(201).json({
      message: "Tạo treatment thành công",
      data: responseData,
      invoice: createdInvoice
        ? {
            _id: createdInvoice._id,
            invoiceNumber: createdInvoice.invoiceNumber,
          }
        : null,
    });
  } catch (error) {
    console.error("CreateTreatment error:", error);
    res.status(500).json({
      message: error.message || "Internal server error",
    });
  }
};

exports.getTreatmentById = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Lấy treatment (KHÔNG cần populate nữa - dùng snapshot)
    const treatment = await Treatment.findById(id);

    if (!treatment) {
      return res.status(404).json({ message: "Treatment not found" });
    }

    // ✅ Trả về dữ liệu từ snapshot
    const response = {
      _id: treatment._id,
      treatmentDate: treatment.treatmentDate,
      diagnosis: treatment.diagnosis,
      bloodPressure: treatment.bloodPressure,
      heartRate: treatment.heartRate,
      temperature: treatment.temperature,
      symptoms: treatment.symptoms,
      totalCost: treatment.totalCost,
      createdAt: treatment.createdAt,
      updatedAt: treatment.updatedAt,

      // Dữ liệu từ snapshot (không cần populate)
      healthProfile: treatment.healthProfileSnapshot
        ? {
            _id: treatment.healthProfile,
            ...treatment.healthProfileSnapshot,
          }
        : null,

      doctor: treatment.doctorSnapshot
        ? {
            _id: treatment.doctor,
            ...treatment.doctorSnapshot,
          }
        : null,

      appointment: treatment.appointmentSnapshot
        ? {
            _id: treatment.appointment,
            ...treatment.appointmentSnapshot,
          }
        : null,

      laborder: treatment.labOrderSnapshot || null,

      prescription: treatment.prescriptionSnapshot || null,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching treatment by ID:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getTreatmentByBooker = async (req, res) => {
  try {
    const { accountId } = req.params;

    // Find patient by account ID
    const patient = await Patient.findOne({ accountId: accountId });
    if (!patient) {
      return res
        .status(404)
        .json({ message: "Patient not found for this account" });
    }

    // Lấy các param phân trang + sắp xếp
    const paging = getPagingParams(req.query, {
      defaultPage: 1,
      defaultLimit: 10,
      sortBy: "treatmentDate",
      sortOrder: "desc",
    });

    // Lọc theo ngày (nếu có)
    const filter = {};
    if (req.query.from || req.query.to) {
      filter.treatmentDate = {};
      if (req.query.from) filter.treatmentDate.$gte = new Date(req.query.from);
      if (req.query.to) filter.treatmentDate.$lte = new Date(req.query.to);
    }

    // Tìm danh sách appointment của booker
    const appointmentIds = await Appointment.find({
      booker_id: patient._id,
    }).distinct("_id");

    if (!appointmentIds.length) {
      return res
        .status(404)
        .json({ message: "No treatments found for this patient" });
    }

    // Query treatment - chỉ lấy dữ liệu cơ bản từ snapshot
    let query = Treatment.find(
      {
        appointment: { $in: appointmentIds },
        ...filter,
      },
      {
        // Chỉ select các trường cần thiết cho bảng danh sách
        _id: 1,
        treatmentDate: 1,
        diagnosis: 1,
        totalCost: 1,
        createdAt: 1,
        // Lấy snapshot fields (dữ liệu đã flatten)
        "healthProfileSnapshot.ownerName": 1,
        "doctorSnapshot.name": 1,
        "doctorSnapshot.specialtyName": 1,
      }
    );

    // Áp dụng sort + skip + limit
    query = applyPagingAndSortingToQuery(query, paging);

    // Lấy dữ liệu + tổng count
    const [treatments, total] = await Promise.all([
      query.lean().exec(),
      Treatment.countDocuments({
        appointment: { $in: appointmentIds },
        ...filter,
      }),
    ]);

    if (!treatments.length) {
      return res
        .status(404)
        .json({ message: "No treatments found for this patient" });
    }

    // Format kết quả - dữ liệu đơn giản cho bảng
    const formatted = treatments.map((t) => ({
      _id: t._id,
      treatmentDate: t.treatmentDate,
      diagnosis: t.diagnosis,
      totalCost: t.totalCost,
      patientName: t.healthProfileSnapshot?.ownerName || "—",
      doctorName: t.doctorSnapshot?.name || "—",
      specialtyName: t.doctorSnapshot?.specialtyName || "—",
    }));

    // Trả kết quả cuối cùng
    res.status(200).json({
      meta: buildMeta(total, paging.page, paging.limit),
      treatments: formatted,
    });
  } catch (error) {
    console.error("Error fetching treatments by booker:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
