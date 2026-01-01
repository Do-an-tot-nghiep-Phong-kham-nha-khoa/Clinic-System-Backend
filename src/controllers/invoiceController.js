// controllers/invoiceController.js
const mongoose = require("mongoose");
const Invoice = require("../models/invoice");
const Prescription = require("../models/prescription");
const LabOrder = require("../models/labOrder");
const Treatment = require("../models/treatment");
const HealthProfile = require("../models/healthProfile");
const Patient = require("../models/patient");
const FamilyMember = require("../models/familyMember");
const { getPagingParams, buildMeta } = require("../helpers/query");
const Appointment = require("../models/appointment");
const vnpayService = require("../services/vnpayService");

/**
 * Helpers
 */
function isValidObjectId(id) {
  return mongoose.isValidObjectId(id) && /^[0-9a-fA-F]{24}$/.test(String(id));
}

/**
 * GET /api/invoices
 * OPTIMIZED: Sử dụng snapshot từ Treatment, giảm queries
 */
exports.list = async (req, res) => {
  try {
    const { query } = req;
    const paging = getPagingParams(query, {
      sortBy: "issued_at",
      sortOrder: "desc",
      defaultLimit: 20,
      maxLimit: 200,
    });

    // Base conditions
    const conditions = {
      ...(query.id &&
        isValidObjectId(query.id) && {
          _id: new mongoose.Types.ObjectId(query.id),
        }),
      ...(query.treatmentId &&
        isValidObjectId(query.treatmentId) && {
          treatmentId: new mongoose.Types.ObjectId(query.treatmentId),
        }),
      ...(query.healthProfile_id &&
        isValidObjectId(query.healthProfile_id) && {
          healthProfile_id: new mongoose.Types.ObjectId(query.healthProfile_id),
        }),
      ...(query.dateFrom || query.dateTo
        ? {
            issued_at: {
              ...(query.dateFrom && { $gte: new Date(query.dateFrom) }),
              ...(query.dateTo && { $lte: new Date(query.dateTo) }),
            },
          }
        : {}),
      ...(query.status && { status: query.status }),
      ...(query.invoiceNumber && {
        invoiceNumber: { $regex: query.invoiceNumber, $options: "i" },
      }),
    };

    let searchConditions = conditions;

    // Free text search (q) by patient/family member name - search in snapshot
    if (query.q && query.q.trim()) {
      const searchTerm = query.q.trim();

      // Tìm Treatment có snapshot.ownerName match
      const treatments = await Treatment.find({
        "healthProfileSnapshot.ownerName": {
          $regex: searchTerm,
          $options: "i",
        },
      })
        .select("_id")
        .lean();

      const treatmentIds = treatments.map((t) => t._id);
      searchConditions = {
        ...conditions,
        treatmentId: { $in: treatmentIds.length ? treatmentIds : [null] },
      };
    } // OPTIMIZED: Chỉ lấy các field cần thiết cho list view
    const dataQuery = Invoice.find(searchConditions)
      .select(
        "_id invoiceNumber issued_at due_date totalPrice status treatmentId payments"
      )
      .populate({
        path: "treatmentId",
        select: "healthProfileSnapshot",
      })
      .sort(paging.sort)
      .skip(paging.skip)
      .limit(paging.limit)
      .lean();

    const [data, total] = await Promise.all([
      dataQuery.exec(),
      Invoice.countDocuments(searchConditions),
    ]);
    // Format response với flat data từ snapshot
    const resolved = data.map((inv) => {
      const treatment = inv.treatmentId;
      const healthProfile = treatment?.healthProfileSnapshot || {};

      return {
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        issued_at: inv.issued_at,
        due_date: inv.due_date || null,
        totalPrice: Number(inv.totalPrice) || 0,
        status: inv.status,
        treatmentId: treatment?._id || null,

        // Thông tin bệnh nhân từ snapshot (flat data)
        patient: {
          name: healthProfile.ownerName || "N/A",
          phone: healthProfile.ownerPhone || "N/A",
          dob: healthProfile.ownerDob || null,
          gender: healthProfile.ownerGender || "N/A",
        },

        payments: Array.isArray(inv.payments) ? inv.payments : [],
      };
    });

    res.json({
      data: resolved,
      meta: buildMeta(total, paging.page, paging.limit),
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /invoices/:id
 * OPTIMIZED: Sử dụng snapshot từ Treatment, không cần populate
 */
exports.getById = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    if (!invoiceId || !isValidObjectId(invoiceId))
      return res.status(400).json({ message: "Valid Invoice ID is required" });

    // Chỉ cần 1 query, lấy snapshot từ Treatment
    const invoice = await Invoice.findById(invoiceId)
      .populate({
        path: "treatmentId",
        select:
          "healthProfileSnapshot labOrderSnapshot prescriptionSnapshot treatmentDate diagnosis totalCost",
      })
      .lean();

    if (!invoice)
      return res
        .status(404)
        .json({ message: `Invoice not found with ID: ${invoiceId}` });

    const treatment = invoice.treatmentId;
    if (!treatment) {
      return res
        .status(404)
        .json({ message: "Treatment not found for this invoice" });
    }

    // Lấy dữ liệu từ snapshot (đã có sẵn, không cần query thêm)
    const healthProfile = treatment.healthProfileSnapshot || {};
    const labOrder = treatment.labOrderSnapshot || null;
    const prescription = treatment.prescriptionSnapshot || null;

    res.json({
      _id: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      issued_at: invoice.issued_at,
      due_date: invoice.due_date || null,
      totalPrice: Number(invoice.totalPrice) || 0,
      status: invoice.status,
      treatmentId: treatment._id,

      // Thông tin bệnh nhân từ snapshot
      patient: {
        name: healthProfile.ownerName || "N/A",
        phone: healthProfile.ownerPhone || "N/A",
        dob: healthProfile.ownerDob || null,
        gender: healthProfile.ownerGender || "N/A",
      },

      // Xét nghiệm từ snapshot
      labOrder: labOrder
        ? {
            _id: labOrder._id,
            totalPrice: Number(labOrder.totalPrice || 0),
            items: (labOrder.items || []).map((item) => ({
              _id: item._id,
              serviceName: item.serviceName,
              quantity: item.quantity,
              price: item.price,
            })),
          }
        : null,

      // Đơn thuốc từ snapshot
      prescription: prescription
        ? {
            _id: prescription._id,
            totalPrice: Number(prescription.totalPrice || 0),
            items: (prescription.items || []).map((item) => ({
              _id: item._id,
              medicineName: item.medicineName,
              quantity: item.quantity,
              price: item.price,
            })),
          }
        : null,

      payments: Array.isArray(invoice.payments) ? invoice.payments : [],
    });
  } catch (error) {
    console.error("Error fetching invoice by ID:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /invoices/:id/status
 * Chỉ update status, không tạo payment record
 */
exports.updateStatus = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { status } = req.body;

    if (!invoiceId || !isValidObjectId(invoiceId))
      return res.status(400).json({ message: "Valid Invoice ID is required" });

    const validStatuses = ["Paid", "Cancelled", "Pending", "Refunded"];
    if (!status || !validStatuses.includes(status))
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      { status },
      { new: true, runValidators: true }
    ).lean();
    if (!updatedInvoice)
      return res
        .status(404)
        .json({ message: `Invoice not found with ID: ${invoiceId}` });

    res.json({
      _id: updatedInvoice._id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      issued_at: updatedInvoice.issued_at,
      due_date: updatedInvoice.due_date,
      totalPrice: Number(updatedInvoice.totalPrice) || 0,
      status: updatedInvoice.status,
      treatmentId: updatedInvoice.treatmentId || null,
      healthProfile_id: updatedInvoice.healthProfile_id || null,
      payments: updatedInvoice.payments || [],
    });
  } catch (error) {
    console.error("Error updating invoice status:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /invoices/:id/pay/cash
 * Thanh toán tiền mặt cho hóa đơn
 */
exports.payCash = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { amount, note } = req.body;

    if (!invoiceId || !isValidObjectId(invoiceId))
      return res.status(400).json({ message: "Valid Invoice ID is required" });

    const invoice = await Invoice.findById(invoiceId)
      .populate({
        path: "treatmentId",
        select: "appointment",
        populate: { path: "appointment", select: "booker_id" },
      })
      .lean();

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    // Check authentication
    const accountId = req.user?.id;
    const userRole = req.user?.role; // Lấy role từ token

    if (!accountId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Kiểm tra đã thanh toán chưa
    if (invoice.status === "Paid")
      return res.status(400).json({ message: "Invoice already paid" });

    if (invoice.status === "Cancelled")
      return res.status(400).json({ message: "Cannot pay cancelled invoice" });

    // Nếu user là Receptionist hoặc Admin, cho phép thanh toán mọi hóa đơn
    const isStaff =
      userRole === "receptionist" ||
      userRole === "admin" ||
      userRole === "doctor";

    if (!isStaff) {
      // Nếu là patient, kiểm tra quyền thanh toán
      let bookerId = null;
      if (invoice.treatmentId?.appointment?.booker_id) {
        bookerId = invoice.treatmentId.appointment.booker_id;
      }

      if (!bookerId) {
        return res
          .status(400)
          .json({ message: "Cannot find appointment booker" });
      }

      const bookerPatient = await Patient.findById(bookerId)
        .select("accountId")
        .lean();
      if (!bookerPatient) {
        return res.status(404).json({ message: "Booker patient not found" });
      }

      if (String(bookerPatient.accountId) !== String(accountId)) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền thanh toán hóa đơn này" });
      }
    }

    // Kiểm tra số tiền
    const payAmount = amount || invoice.totalPrice;
    if (payAmount <= 0)
      return res.status(400).json({ message: "Invalid payment amount" });

    // Cập nhật invoice (không dùng lean để có thể save)
    const invoiceDoc = await Invoice.findById(invoiceId);

    // Tạo payment record
    invoiceDoc.payments.push({
      method: "cash",
      amount: payAmount,
      status: "success",
      provider: "cash",
      paid_at: new Date(),
      meta: note ? { note } : {},
    });

    // Update status thành Paid
    invoiceDoc.status = "Paid";

    await invoiceDoc.save();

    res.json({
      message: "Payment successful",
      invoice: {
        _id: invoiceDoc._id,
        invoiceNumber: invoiceDoc.invoiceNumber,
        status: invoiceDoc.status,
        totalPrice: invoiceDoc.totalPrice,
        payments: invoiceDoc.payments,
      },
    });
  } catch (error) {
    console.error("Error processing cash payment:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /invoices/:id/pay/vnpay
 * Tạo payment URL VNPay
 */
exports.createVnPayPayment = async (req, res) => {
  try {
    const invoiceId = req.params.id;

    if (!invoiceId || !isValidObjectId(invoiceId)) {
      return res.status(400).json({ message: "Valid Invoice ID is required" });
    }

    // Lấy invoice và populate cần thiết
    const invoice = await Invoice.findById(invoiceId)
      .populate({ path: "healthProfile_id", select: "ownerId ownerModel" })
      .populate({
        path: "treatmentId",
        select: "appointment",
        populate: { path: "appointment", select: "booker_id" },
      })
      .lean();

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    } // Check authentication
    const accountId = req.user?.id;
    const userRole = req.user?.role; // Lấy role từ token

    if (!accountId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Kiểm tra invoice đã thanh toán chưa
    if (invoice.status === "Paid") {
      return res.status(400).json({ message: "Invoice already paid" });
    }

    // Nếu user là Receptionist hoặc Admin, cho phép thanh toán mọi hóa đơn
    const isStaff =
      userRole === "receptionist" ||
      userRole === "admin" ||
      userRole === "doctor";

    if (!isStaff) {
      // Nếu là patient, kiểm tra quyền thanh toán
      // Lấy booker_id từ appointment
      let bookerId = null;
      if (invoice.treatmentId?.appointment?.booker_id) {
        bookerId = invoice.treatmentId.appointment.booker_id;
      }

      if (!bookerId) {
        return res
          .status(400)
          .json({ message: "Cannot find appointment booker" });
      }

      // Lấy accountId của booker
      const bookerPatient = await Patient.findById(bookerId)
        .select("accountId")
        .lean();
      if (!bookerPatient) {
        return res.status(404).json({ message: "Booker patient not found" });
      }

      // Kiểm tra quyền thanh toán
      if (String(bookerPatient.accountId) !== String(accountId)) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền thanh toán hóa đơn này" });
      }
    } // Tạo mã giao dịch unique
    const txnRef = `INV${invoiceId.slice(-8)}_${Date.now()}`;

    // Lấy returnUrl từ request body (nếu có)
    const returnUrl = req.body.returnUrl;

    // Tạo payment record với status pending
    const paymentRecord = {
      method: "vnpay",
      amount: invoice.totalPrice,
      status: "pending",
      provider: "vnpay",
      providerPaymentId: txnRef,
      meta: {
        createdAt: new Date(),
        returnUrl: returnUrl || null, // Lưu returnUrl để dùng sau
      },
    };

    await Invoice.findByIdAndUpdate(invoiceId, {
      $push: { payments: paymentRecord },
    });

    // Build VNPay payment URL
    const ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip ||
      "127.0.0.1";

    const paymentUrl = vnpayService.buildPaymentUrl({
      amount: invoice.totalPrice,
      orderId: txnRef,
      orderInfo: `Thanh toan hoa don ${
        invoice.invoiceNumber || invoiceId.slice(-8)
      }`,
      orderType: "billpayment",
      ipAddr: ipAddr,
      locale: "vn",
      // returnUrl sẽ được lấy từ config trong vnpayService
    });

    console.log("VNPay Payment URL created:", paymentUrl);

    res.json({
      checkoutUrl: paymentUrl,
      txnRef: txnRef,
    });
  } catch (error) {
    console.error("Error creating VNPay payment:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /invoices/vnpay/return
 * VNPay callback sau khi thanh toán
 */
exports.vnpayReturn = async (req, res) => {
  try {
    const vnp_Params = req.query;

    console.log("=== VNPay Return ===");
    console.log("All Params:", JSON.stringify(vnp_Params, null, 2)); // Helper function để build error redirect URL
    const buildErrorRedirect = (errorMessage, returnUrl = null) => {
      const vnpayConfig = require("../../config/vnpay");
      if (returnUrl) {
        const separator = returnUrl.includes("?") ? "&" : "?";
        return `${returnUrl}${separator}status=error&message=${encodeURIComponent(
          errorMessage
        )}`;
      }
      return `${
        vnpayConfig.frontend_Url
      }/receptionist/payment-result?status=error&message=${encodeURIComponent(
        errorMessage
      )}`;
    };

    // Verify secure hash
    const isValid = vnpayService.verifyReturnUrl(vnp_Params);
    console.log("Signature valid:", isValid);

    if (!isValid) {
      console.error("❌ Invalid secure hash");
      return res.redirect(buildErrorRedirect("Chữ ký không hợp lệ"));
    }

    const {
      vnp_TxnRef,
      vnp_ResponseCode,
      vnp_TransactionNo,
      vnp_BankCode,
      vnp_CardType,
    } = vnp_Params;
    console.log("TxnRef:", vnp_TxnRef);
    console.log("ResponseCode:", vnp_ResponseCode);
    console.log("TransactionNo:", vnp_TransactionNo); // Tìm payment record
    const invoice = await Invoice.findOne({
      "payments.providerPaymentId": vnp_TxnRef,
    });

    if (!invoice) {
      console.error("❌ Invoice not found for txnRef:", vnp_TxnRef);
      return res.redirect(buildErrorRedirect("Không tìm thấy hóa đơn"));
    }

    console.log("✅ Invoice found:", invoice._id); // Update payment record
    const paymentIndex = invoice.payments.findIndex(
      (p) => p.providerPaymentId === vnp_TxnRef
    );

    if (paymentIndex === -1) {
      console.error("❌ Payment record not found");
      return res.redirect(
        buildErrorRedirect("Không tìm thấy thông tin thanh toán")
      );
    }

    // Lấy returnUrl từ payment record
    const returnUrl = invoice.payments[paymentIndex].meta?.returnUrl;
    console.log("Return URL from payment record:", returnUrl);

    // Update payment status
    invoice.payments[paymentIndex].status =
      vnp_ResponseCode === "00" ? "success" : "failed";
    invoice.payments[paymentIndex].providerTransactionNo = vnp_TransactionNo;
    invoice.payments[paymentIndex].paid_at = new Date();
    invoice.payments[paymentIndex].meta = {
      ...invoice.payments[paymentIndex].meta,
      vnp_ResponseCode,
      vnp_BankCode,
      vnp_CardType,
      message: vnpayService.getResponseMessage(vnp_ResponseCode),
    };

    // Nếu thanh toán thành công, update invoice status
    if (vnp_ResponseCode === "00") {
      invoice.status = "Paid";
    }

    await invoice.save();

    console.log("Payment updated successfully");

    // Redirect về frontend - sử dụng returnUrl nếu có
    const vnpayConfig = require("../../config/vnpay");
    const status = vnp_ResponseCode === "00" ? "success" : "failed";
    const message = vnpayService.getResponseMessage(vnp_ResponseCode);

    // Xác định redirect URL
    let redirectUrl;
    if (returnUrl) {
      // Nếu có returnUrl thì sử dụng nó
      const separator = returnUrl.includes("?") ? "&" : "?";
      redirectUrl = `${returnUrl}${separator}status=${status}&message=${encodeURIComponent(
        message
      )}&invoiceId=${invoice._id}`;
    } else {
      redirectUrl = `${
        vnpayConfig.frontend_Url
      }/receptionist/payment-result?status=${status}&message=${encodeURIComponent(
        message
      )}&invoiceId=${invoice._id}`;
    }

    console.log("Redirecting to:", redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Error handling VNPay return:", error);
    const vnpayConfig = require("../../config/vnpay");
    res.redirect(
      `${
        vnpayConfig.frontend_Url
      }/receptionist/payment-result?status=error&message=${encodeURIComponent(
        "Lỗi hệ thống"
      )}`
    );
  }
};

/**
 * GET /invoices/vnpay/ipn
 * VNPay IPN (Instant Payment Notification)
 */
exports.vnpayIPN = async (req, res) => {
  try {
    const vnp_Params = req.query;

    console.log("=== VNPay IPN ===");
    console.log("Params:", vnp_Params);

    // Verify secure hash
    const isValid = vnpayService.verifyReturnUrl(vnp_Params);

    if (!isValid) {
      console.error("Invalid secure hash");
      return res.json({ RspCode: "97", Message: "Invalid signature" });
    }

    const { vnp_TxnRef, vnp_ResponseCode, vnp_TransactionNo } = vnp_Params;

    // Tìm invoice
    const invoice = await Invoice.findOne({
      "payments.providerPaymentId": vnp_TxnRef,
    });

    if (!invoice) {
      return res.json({ RspCode: "01", Message: "Order not found" });
    }

    // Kiểm tra đã update chưa
    const payment = invoice.payments.find(
      (p) => p.providerPaymentId === vnp_TxnRef
    );

    if (payment && payment.status !== "pending") {
      return res.json({ RspCode: "02", Message: "Order already confirmed" });
    }

    // Update payment
    const paymentIndex = invoice.payments.findIndex(
      (p) => p.providerPaymentId === vnp_TxnRef
    );

    if (paymentIndex !== -1) {
      invoice.payments[paymentIndex].status =
        vnp_ResponseCode === "00" ? "success" : "failed";
      invoice.payments[paymentIndex].providerTransactionNo = vnp_TransactionNo;
      invoice.payments[paymentIndex].paid_at = new Date();

      if (vnp_ResponseCode === "00") {
        invoice.status = "Paid";
      }

      await invoice.save();
    }

    res.json({ RspCode: "00", Message: "success" });
  } catch (error) {
    console.error("Error handling VNPay IPN:", error);
    res.json({ RspCode: "99", Message: "System error" });
  }
};

exports.mockVnPayCheckout = async (req, res) => {
  try {
    const { paymentId, invoiceId, returnUrl } = req.query;
    if (!paymentId || !invoiceId)
      return res.status(400).send("Missing paymentId or invoiceId");

    const html = `<html>
      <head><title>Mock VNPay Checkout</title></head>
      <body style="font-family: Arial, sans-serif; padding:20px;">
        <h2>VNPay Mock Checkout</h2>
        <p>Payment ID: <strong>${paymentId}</strong></p>
        <p>Invoice ID: <strong>${invoiceId}</strong></p>
        <form method="POST" action="/invoices/mock/vnpay/complete">
          <input type="hidden" name="paymentId" value="${paymentId}" />
          <input type="hidden" name="invoiceId" value="${invoiceId}" />
          <input type="hidden" name="returnUrl" value="${returnUrl || "/"}" />
          <button type="submit" style="padding:10px 16px; font-size:16px;">Simulate Payment (VNPay)</button>
        </form>
      </body>
    </html>`;
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    console.error("Error rendering mock checkout:", error);
    res.status(500).send("Server error");
  }
};

exports.mockVnPayComplete = async (req, res) => {
  try {
    const { paymentId, invoiceId, returnUrl } = req.body;
    if (!paymentId || !invoiceId)
      return res.status(400).send("Missing paymentId or invoiceId");

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).send("Invoice not found");

    const idx = (invoice.payments || []).findIndex(
      (p) => p.providerPaymentId === paymentId
    );
    if (idx === -1) return res.status(400).send("Payment token not found");

    invoice.payments[idx].status = "success";
    invoice.payments[idx].paid_at = new Date();
    invoice.status = "Paid";

    await invoice.save();
    res.redirect(
      `${
        returnUrl || "/"
      }?status=success&paymentId=${paymentId}&invoiceId=${invoiceId}`
    );
  } catch (error) {
    console.error("Error completing mock vnpay payment:", error);
    res.status(500).send("Server error");
  }
};
