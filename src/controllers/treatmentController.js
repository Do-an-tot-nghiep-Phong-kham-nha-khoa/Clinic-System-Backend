const Treatment = require("../models/treatment");
const Doctor = require("../models/doctor");
const Patient = require("../models/patient");
const Appointment = require("../models/appointment");
const FamilyMember = require("../models/familyMember");
const LabOrder = require("../models/labOrder");
const Prescription = require("../models/prescription");
const HealthProfile = require("../models/healthProfile");
const Invoice = require("../models/invoice");

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

    if (!healthProfile || !doctor || !treatmentDate || !diagnosis) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
    }

    // ========== 1. Lấy dữ liệu gốc ==========
    const hp = await HealthProfile.findById(healthProfile);
    if (!hp)
      return res.status(404).json({ message: "Không tìm thấy health profile" });

    const doctorDoc = await Doctor.findById(doctor).populate(
      "specialtyId",
      "name"
    );
    if (!doctorDoc)
      return res.status(404).json({ message: "Không tìm thấy bác sĩ" });

    let appointmentDoc = null;
    if (appointment) {
      appointmentDoc = await Appointment.findById(appointment);
      await Appointment.findByIdAndUpdate(appointment, {
        status: "completed",
      });
    }

    // ========== 2. Tạo HealthProfile Snapshot ==========
    let ownerModelRef = hp.ownerModel === "Patient" ? Patient : FamilyMember;
    const owner = await ownerModelRef
      .findById(hp.ownerId)
      .select("name dob phone gender");

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

    // ========== 3. Tạo Doctor Snapshot ==========
    const doctorSnapshot = {
      name: doctorDoc.name || "",
      phone: doctorDoc.phone || "",
      specialtyId: doctorDoc.specialtyId?._id || null,
      specialtyName: doctorDoc.specialtyId?.name || "",
    };

    // ========== 4. Tạo Appointment Snapshot ==========
    let appointmentSnapshot = null;
    if (appointmentDoc) {
      appointmentSnapshot = {
        appointmentDate: appointmentDoc.appointmentDate,
        timeSlot: appointmentDoc.timeSlot,
        reason: appointmentDoc.reason,
      };
    }

    // ========== 5. Tạo LabOrder Snapshot ==========
    let labOrderSnapshot = null;
    let labOrderPrice = 0;
    if (laborder) {
      const labOrderDoc = await LabOrder.findById(laborder).populate(
        "items.serviceId",
        "name price"
      );
      if (!labOrderDoc)
        return res.status(404).json({ message: "Không tìm thấy LabOrder" });
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

    // ========== 6. Tạo Prescription Snapshot ==========
    let prescriptionSnapshot = null;
    let prescriptionPrice = 0;
    if (prescription) {
      const prescriptionDoc = await Prescription.findById(
        prescription
      ).populate("items.medicineId", "name unit manufacturer price");
      if (!prescriptionDoc)
        return res.status(404).json({ message: "Không tìm thấy Prescription" });
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

    // ========== 7. Tạo Treatment với Snapshot ==========
    const saved = await Treatment.create({
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
      // Lưu snapshots
      healthProfileSnapshot,
      doctorSnapshot,
      appointmentSnapshot,
      labOrderSnapshot,
      prescriptionSnapshot,
    });

    // ========== 8. Trả về dữ liệu từ snapshot (không cần populate) ==========
    const responseData = {
      ...saved.toObject(),
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
    }; // ========== 9. Tạo Invoice ==========
    let createdInvoice = null;
    if (prescription || laborder) {
      try {
        const invoiceCount = await Invoice.countDocuments();
        const invoiceNumber = `INV${Date.now()}-${(invoiceCount + 1)
          .toString()
          .padStart(4, "0")}`;

        const invoice = new Invoice({
          invoiceNumber: invoiceNumber,
          treatmentId: saved._id,
          totalPrice: totalCost,
          status: "Pending",
          healthProfile_id: healthProfile,
          issued_at: treatmentDate,
          prescriptionId: prescription || null,
          labOrderId: laborder || null,
        });

        createdInvoice = await invoice.save();
      } catch (invoiceError) {
        console.log("Lỗi khi tạo Invoice:", invoiceError.message);
      }
    }

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
    console.log(error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
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
