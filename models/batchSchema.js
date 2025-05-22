const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema(
  {
    batchName: {
      type: String,
      required: true,
    },
    scheduleTitle: {
      type: String,
      required: true,
    },
    modeOfBatch: {
      type: String,
      enum: ["Online", "Offline", "Hybrid"],
      required: true,
    },
    sequenceNumber: {
      type: Number,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    duration: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "teacher",
      required: false, // Changed to optional
    },
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "intern",
      },
    ],
    description: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Upcoming", "Ongoing", "Completed", "Cancelled"],
      default: "Upcoming",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("batch", batchSchema);