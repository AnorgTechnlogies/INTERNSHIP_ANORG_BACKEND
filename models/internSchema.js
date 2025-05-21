const mongoose = require("mongoose");

const internSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
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
    role: {
      type: String,
      default: "Intern",
    },
    // Intern may be assigned to one or multiple batches
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
