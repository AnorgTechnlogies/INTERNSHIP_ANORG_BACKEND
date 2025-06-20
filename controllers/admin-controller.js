const Admin = require("../models/adminSchema.js");
const Batch = require("../models/batchSchema.js");
const Intern = require("../models/internSchema.js");
const Teacher = require("../models/teacherSchema.js");
const Notice = require("../models/noticeSchema.js");
const Complain = require("../models/complainSchema.js");
const XLSX = require("xlsx");
const bcrypt = require("bcrypt");

const adminRegister = async (req, res) => {
  console.log(req.body);

  try {
    // Check if admin with this email already exists
    const existingAdminByEmail = await Admin.findOne({ email: req.body.email });

    if (existingAdminByEmail) {
      return res.status(400).send({ message: "Email already exists" });
    }

    // Hash the password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    // Create new admin with hashed password
    const admin = new Admin({
      ...req.body,
      password: hashedPassword,
    });

    // Save admin to database
    const result = await admin.save();

    // Remove password from response
    result.password = undefined;

    // Send successful response
    res.status(201).send(result);
  } catch (err) {
    console.error("Admin registration error:", err);
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

const adminLogIn = async (req, res) => {
  console.log(req.body);

  if (req.body.email && req.body.password) {
    let admin = await Admin.findOne({ email: req.body.email });
    if (admin) {
      // Compare hashed password
      const isMatch = await bcrypt.compare(req.body.password, admin.password);
      if (isMatch) {
        admin.password = undefined;
        res.send(admin);
      } else {
        res.send({ message: "Invalid password" });
      }
    } else {
      res.send({ message: "User not found" });
    }
  } else {
    res.send({ message: "Email and password are required" });
  }
};

const getAdminDetail = async (req, res) => {
  try {
    let admin = await Admin.findById(req.params.id);
    if (admin) {
      admin.password = undefined;
      res.send(admin);
    } else {
      res.send({ message: "No admin found" });
    }
  } catch (err) {
    res.status(500).json(err);
  }
};

const bulkInternRegister = async (req, res) => {
  try {
    const { batchId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (!batchId) {
      return res.status(400).json({ message: "Batch ID is required" });
    }

    const validMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const validExtensions = [".xlsx", ".xls"];
    const fileExtension = file.originalname.toLowerCase().slice(-5);
    if (
      !validMimeTypes.includes(file.mimetype) ||
      !validExtensions.some((ext) => fileExtension.endsWith(ext))
    ) {
      return res.status(400).json({
        message: `Invalid file type: ${file.originalname}. Only .xlsx or .xls files are allowed`,
      });
    }

    if (!file.buffer || file.buffer.length === 0) {
      return res.status(400).json({
        message: `Invalid file: ${file.originalname}. File buffer is missing or empty`,
      });
    }

    let batch;
    try {
      batch = await Batch.findById(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }
    } catch (err) {
      return res.status(400).json({ message: "Invalid Batch ID format" });
    }

    let workbook;
    try {
      workbook = XLSX.read(file.buffer, { type: "buffer" });
    } catch (err) {
      return res.status(400).json({
        message: `Invalid Excel file format: Unable to read file: ${file.originalname}`,
        details: err.message,
      });
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return res
        .status(400)
        .json({
          message: `Excel file contains no sheets: ${file.originalname}`,
        });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    let data;
    try {
      data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (!data || data.length === 0) {
        return res
          .status(400)
          .json({
            message: `Excel file contains no data: ${file.originalname}`,
          });
      }
    } catch (err) {
      return res.status(400).json({
        message: `Invalid Excel file format: Unable to parse sheet: ${file.originalname}`,
        details: err.message,
      });
    }

    const headers = data[0].map((h) => String(h).toLowerCase().trim());
    const expectedHeaders = [
      "name",
      "father name",
      "email id",
      "password",
      "student mobile no",
      "parent mobile no",
      "joiningdate",
      "college name",
      "address",
    ];
    const requiredHeaders = ["name", "email id"];
    const missingRequiredHeaders = requiredHeaders.filter(
      (h) => !headers.includes(h)
    );
    if (missingRequiredHeaders.length > 0) {
      return res.status(400).json({
        message: `Missing required columns in ${
          file.originalname
        }: ${missingRequiredHeaders.join(", ")}`,
      });
    }

    const nameIdx = headers.indexOf("name");
    const fatherNameIdx = headers.indexOf("father name");
    const emailIdx = headers.indexOf("email id");
    const mobileNoIdx = headers.indexOf("student mobile no");
    const parentsMobileNoIdx = headers.indexOf("parent mobile no");
    const joiningDateIdx = headers.indexOf("joiningdate");
    const collegeNameIdx = headers.indexOf("college name");
    const addressIdx = headers.indexOf("address");

    const rows = data.slice(1);
    if (rows.length === 0) {
      return res
        .status(400)
        .json({
          message: `Excel file contains no intern data: ${file.originalname}`,
        });
    }

    const registered = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row[nameIdx]?.toString()?.trim();
      const fatherName =
        fatherNameIdx !== -1
          ? row[fatherNameIdx]?.toString()?.trim()
          : undefined;
      let email =
        emailIdx !== -1 ? row[emailIdx]?.toString()?.trim() : undefined;
      const mobileNo =
        mobileNoIdx !== -1 ? row[mobileNoIdx]?.toString()?.trim() : undefined;
      const parentsMobileNo =
        parentsMobileNoIdx !== -1
          ? row[parentsMobileNoIdx]?.toString()?.trim()
          : undefined;
      const joiningDate =
        joiningDateIdx !== -1 && row[joiningDateIdx]
          ? new Date(row[joiningDateIdx])
          : undefined;
      const collegeName =
        collegeNameIdx !== -1
          ? row[collegeNameIdx]?.toString()?.trim()
          : undefined;
      const address =
        addressIdx !== -1 ? row[addressIdx]?.toString()?.trim() : undefined;

      if (!name || !email) {
        errors.push(`Row ${i + 2}: Missing required fields (name or email)`);
        continue;
      }

      // Append @user to email if it doesn't contain an @ symbol
      if (!email.includes("@")) {
        email = `${email}@user`;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push(`Row ${i + 2}: Invalid email format: ${email}`);
        continue;
      }

      // Set default password as the part of the email before @
      const password = email.split("@")[0];
      if (!password) {
        errors.push(
          `Row ${i + 2}: Unable to generate password from email: ${email}`
        );
        continue;
      }

      if (joiningDate && isNaN(joiningDate.getTime())) {
        errors.push(
          `Row ${i + 2}: Invalid joining date format: ${row[joiningDateIdx]}`
        );
        continue;
      }

      try {
        const existingIntern = await Intern.findOne({ email });
        if (existingIntern) {
          errors.push(`Row ${i + 2}: Email already exists: ${email}`);
          continue;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const intern = new Intern({
          name,
          fatherName,
          email,
          password: hashedPassword,
          mobileNo,
          parentsMobileNo,
          joiningDate,
          collegeName,
          address,
          role: "Intern",
          batches: [batchId],
          attendance: [],
        });

        const savedIntern = await intern.save();

        await Batch.findByIdAndUpdate(batchId, {
          $push: { students: savedIntern._id },
        });

        registered.push({ name, email, status: "Registered" });
      } catch (err) {
        errors.push(
          `Row ${i + 2}: Error registering intern ${name || email}: ${
            err.message
          }`
        );
      }
    }

    res.status(200).json({
      registered,
      errors,
    });
  } catch (err) {
    console.error("Bulk upload error:", err);
    res.status(500).json({
      message: "Server error during bulk upload",
      error: err.message,
    });
  }
};

// Get attendance for all interns by date, week, or month
const getAllAttendance = async (req, res) => {
  try {
    const { period, date } = req.query; // period: 'daily', 'weekly', 'monthly'

    // Validate query parameters
    if (!period || !['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).send({ message: "Invalid or missing period parameter" });
    }

    if (!date) {
      return res.status(400).send({ message: "Date parameter is required" });
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate)) {
      return res.status(400).send({ message: "Invalid date format" });
    }

    // Define date range based on period
    let startDate, endDate;
    if (period === 'daily') {
      startDate = new Date(targetDate.setHours(0, 0, 0, 0));
      endDate = new Date(targetDate.setHours(23, 59, 59, 999));
    } else if (period === 'weekly') {
      startDate = new Date(targetDate);
      startDate.setDate(targetDate.getDate() - targetDate.getDay()); // Start of week (Sunday)
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6); // End of week (Saturday)
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'monthly') {
      startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    // Fetch interns with their attendance within the date range
    const interns = await Intern.find({})
      .select('name email attendance')
      .lean();

    // Generate list of dates in the period
    const dateList = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dateList.push(new Date(d).toISOString().substring(0, 10));
    }

    // Format attendance data as a map for each intern
    const attendanceData = interns.map(intern => {
      const attendanceMap = {};
      dateList.forEach(date => {
        const record = intern.attendance.find(a => 
          new Date(a.date).toISOString().substring(0, 10) === date
        );
        attendanceMap[date] = record ? record.status : null;
      });

      return {
        _id: intern._id,
        name: intern.name,
        email: intern.email,
        attendance: attendanceMap,
      };
    });

    // Aggregate summary statistics
    const summary = {
      totalInterns: attendanceData.length,
      totalPresent: attendanceData.reduce((sum, intern) => 
        sum + Object.values(intern.attendance).filter(a => a === 'Present').length, 0),
      totalAbsent: attendanceData.reduce((sum, intern) => 
        sum + Object.values(intern.attendance).filter(a => a === 'Absent').length, 0),
      period,
      startDate,
      endDate,
      dateList,
    };

    res.status(200).send({ attendanceData, summary });
  } catch (err) {
    console.error("Attendance fetch error:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
};



module.exports = {
  adminRegister,
  adminLogIn,
  getAdminDetail,
  bulkInternRegister,
  getAllAttendance,
};
