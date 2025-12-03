// services/invoiceService.js
const Patient = require("../models/patient");
const FamilyMember = require("../models/familyMember");

async function resolveOwnerDetail(healthProfile) {
  if (!healthProfile || !healthProfile.ownerId || !healthProfile.ownerModel) return null;

  if (healthProfile.ownerModel === "Patient") {
    const p = await Patient.findById(healthProfile.ownerId)
      .select("name dob phone gender")
      .lean();
    if (p) return { name: p.name, dob: p.dob, phone: p.phone, gender: p.gender };
  } else if (healthProfile.ownerModel === "FamilyMember") {
    const fm = await FamilyMember.findById(healthProfile.ownerId)
      .select("name dob phone gender")
      .lean();
    if (fm) return { name: fm.name, dob: fm.dob, phone: fm.phone, gender: fm.gender };
  }
  return null;
}

function formatPrescription(prescription) {
  if (!prescription) return null;
  return {
    _id: prescription._id,
    totalPrice: Number(prescription.totalPrice) || 0,
    items: Array.isArray(prescription.items)
      ? prescription.items.map((item) => ({
          _id: item._id,
          medicineId: item.medicineId?._id || null,
          medicine: item.medicineId || null,
          quantity: item.quantity,
        }))
      : [],
  };
}

function formatLabOrder(labOrder) {
  if (!labOrder) return null;
  return {
    _id: labOrder._id,
    totalPrice: Number(labOrder.totalPrice) || 0,
    items: Array.isArray(labOrder.items)
      ? labOrder.items.map((item) => ({
          _id: item._id,
          quantity: item.quantity,
          serviceId: item.serviceId?._id || null,
          service: item.serviceId || null,
        }))
      : [],
  };
}

function generateInvoiceNumber() {
  const d = new Date();
  const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const suffix = String(Date.now()).slice(-6);
  return `INV-${datePart}-${suffix}`;
}

function isValidObjectId(id) {
  return id && /^[0-9a-fA-F]{24}$/.test(String(id));
}

module.exports = {
  resolveOwnerDetail,
  formatPrescription,
  formatLabOrder,
  generateInvoiceNumber,
  isValidObjectId,
};
