const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "Teacher",
    },
    // A teacher can handle multiple batches
    teachBatches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "batch",
      }
    ],
    attendance: [
      {
        date: {
          type: Date,
          required: true,
        },
        presentCount: {
          type: Number,
        },
        absentCount: {
          type: Number,
        },
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("teacher", teacherSchema);
