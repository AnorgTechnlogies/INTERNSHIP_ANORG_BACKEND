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
  adminID: { type: String, required: true },
  attendance: [
    {
      date: { type: Date, required: true },
      status: {
        type: String,
        enum: ["Present", "Absent", "Work From Home", "Leave"],
        required: true,
      },
      loginTime: { type: Date },
      logoutTime: { type: Date },
      workingHours: { type: Number },
      whatsappSent: { type: Boolean, default: false },
    },
  ],
});

module.exports = mongoose.model("Employee", employeeSchema);