// models/ChatMessage.js
const mongoose = require("mongoose");

const ChatMessageSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: false, // bác sĩ hoặc chatbot có thể không cần patientId
    },

    conversationId: {
      type: String,   // dùng string để dễ generate từ frontend hoặc backend
      required: true,
      index: true,
    },

    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    metadata: {
      type: Object,
      default: {},
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { versionKey: false }
);

module.exports = mongoose.model("ChatMessage", ChatMessageSchema);
