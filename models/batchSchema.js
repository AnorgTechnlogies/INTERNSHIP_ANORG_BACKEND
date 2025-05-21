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
      type: String, // Or an object with address details if needed
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    duration: {
      type: String, // e.g., "2 weeks", "3 hours"
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
      type: String, // e.g., "9:00 AM - 12:00 PM"
      required: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "teacher",
      required: true,
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
