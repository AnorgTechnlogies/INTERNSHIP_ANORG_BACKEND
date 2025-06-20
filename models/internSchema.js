const mongoose = require("mongoose");

const internSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    fatherName: {
      type: String,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    mobileNo: {
      type: String,
    },
    parentsMobileNo: {
      type: String,
    },
    joiningDate: {
      type: Date,
    },
    collegeName: {
      type: String,
    },
    address: {
      type: String,
    },
    role: {
      type: String,
      default: "Intern",
    },
    batches: [
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
        status: {
          type: String,
          enum: ["Present", "Absent"],
          required: true,
        },
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("intern", internSchema);