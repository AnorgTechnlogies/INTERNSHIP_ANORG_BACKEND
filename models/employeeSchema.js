const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  designation: { type: String, required: true },
  department: { type: String, required: true },
  skills: [String],
  mobileNo: String,
  joiningDate: Date,
  address: String,
  role: { type: String, default: "Employee" },
  attendance: [
    {
      date: { type: Date, required: true },
      status: {
        type: String,
        enum: ["Present", "Absent", "Work From Home", "Leave"],
        required: true,
      },
    },
  ],
  adminID: { type: String, required: true }, // Add this field
});

module.exports = mongoose.model("Employee", employeeSchema);
