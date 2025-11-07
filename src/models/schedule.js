const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema({
  doctor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  timeSlots: [
    {
      startTime: String,   // "09:00"
      endTime: String,     // "09:30"
      isBooked: {
        type: Boolean,
        default: false,
      },
    },
  ],
}, {
  timestamps: true,
});

// 1 bác sĩ chỉ có 1 schedule cho mỗi ngày
scheduleSchema.index({ doctor_id: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Schedule", scheduleSchema);