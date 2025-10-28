const mongoose = require("mongoose");

const forgotPasswordSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true // Tăng tốc tìm kiếm theo email
  },
  otp: {
    type: String,
    required: true
  },
  expireAt: {
    type: Date,
    default: () => new Date(Date.now() + 3 * 60 * 1000), // Hết hạn sau 3 phút
    index: { expires: 0 } // TTL index: xóa ngay khi expireAt < now()
  }
}, {
  timestamps: true // Tự động thêm createdAt, updatedAt
});

module.exports = mongoose.model("ForgotPassword", forgotPasswordSchema);
