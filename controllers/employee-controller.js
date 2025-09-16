const Employee = require("../models/employeeSchema.js");
const XLSX = require("xlsx");
const bcrypt = require("bcrypt");
const axios = require("axios");

const employeeRegister = async (req, res) => {
  console.log(req.body);

  try {
    const existingEmployeeByEmail = await Employee.findOne({
      email: req.body.email,
    });
    const existingEmployeeById = await Employee.findOne({
      employeeId: req.body.employeeId,
    });

    if (existingEmployeeByEmail) {
      return res.status(400).send({ message: "Email already exists" });
    }
    if (existingEmployeeById) {
      return res.status(400).send({ message: "Employee ID already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    const employee = new Employee({
      ...req.body,
      password: hashedPassword,
    });

    const result = await employee.save();
    result.password = undefined;
    res.status(201).send(result);
  } catch (err) {
    console.error("Employee registration error:", err);
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

const employeeLogIn = async (req, res) => {
  console.log(req.body);

  if (req.body.email && req.body.password) {
    let employee = await Employee.findOne({ email: req.body.email });
    if (employee) {
      const isMatch = await bcrypt.compare(
        req.body.password,
        employee.password
      );
      if (isMatch) {
        employee.password = undefined;
        res.send(employee);
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

const getEmployeeDetail = async (req, res) => {
  try {
    let employee = await Employee.findById(req.params.id);
    if (employee) {
      employee.password = undefined;
      res.send(employee);
    } else {
      res.send({ message: "No employee found" });
    }
  } catch (err) {
    res.status(500).json(err);
  }
};

const getAllEmployeesByAdmin = async (req, res) => {
  try {
    const adminID = req.params.adminID;
    const employees = await Employee.find({ adminID })
      .select("-password")
      .lean();
    if (!employees.length) {
      return res
        .status(200)
        .send({ message: "No employees found for this admin" });
    }
    res.status(200).send(employees);
  } catch (err) {
    console.error("Error fetching employees:", err);
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

const employeeClockIn = async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      // console.log("DEBUG: Missing employeeId in request body");
      return res.status(400).json({ message: "Employee ID or email is required" });
    }

    // Get current date and normalize to midnight in UTC to avoid timezone issues
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Use UTC to ensure consistency
    const todayStr = today.toISOString().split('T')[0];
    // console.log(`DEBUG: Current date (today) set to: ${todayStr} (UTC: ${today.toISOString()})`);

    const employee = await Employee.findOne({
      $or: [{ employeeId }, { email: employeeId }],
    });
    if (!employee) {
      // console.log(`DEBUG: No employee found for employeeId/email: ${employeeId}`);
      return res.status(404).json({ message: "Employee not found" });
    }

    // console.log(`DEBUG: Found employee: ${employee.employeeId}, attendance count: ${employee.attendance.length}`);

    // Check for existing attendance record for today
    const existingAttendanceIndex = employee.attendance.findIndex((a) => {
      const recordDate = new Date(a.date);
      recordDate.setUTCHours(0, 0, 0, 0); // Normalize to UTC midnight
      const recordDateStr = recordDate.toISOString().split('T')[0];
      // console.log(`DEBUG: Comparing record date: ${recordDateStr} with today: ${todayStr}`);
      return recordDateStr === todayStr;
    });

    if (existingAttendanceIndex !== -1) {
      const existingRecord = employee.attendance[existingAttendanceIndex];
      // console.log(`DEBUG: Found existing record for ${todayStr}:`, JSON.stringify(existingRecord, null, 2));
      if (existingRecord.status === "Present" && existingRecord.loginTime) {
        // console.log(`DEBUG: Already clocked in, loginTime: ${existingRecord.loginTime}`);
        return res.status(400).json({
          message: "Already clocked in for today",
          loginTime: existingRecord.loginTime,
        });
      }
      if (existingRecord.status === "Absent") {
        // console.log(`DEBUG: Attendance marked as Absent for ${todayStr}`);
        return res.status(400).json({
          message: "Attendance already marked as Absent for today",
        });
      }
    } else {
      console.log(`DEBUG: No attendance record found for ${todayStr}`);
    }

    const loginTime = new Date();
    // console.log(`DEBUG: Setting loginTime to: ${loginTime.toISOString()}`);

    const attendanceRecord = {
      date: today, // Use normalized UTC date for today
      status: "Present",
      loginTime,
      whatsappSent: false,
    };
    // console.log(`DEBUG: Creating/Updating attendance record:`, JSON.stringify(attendanceRecord, null, 2));

    if (existingAttendanceIndex !== -1) {
      // console.log(`DEBUG: Updating existing attendance record at index ${existingAttendanceIndex}`);
      employee.attendance[existingAttendanceIndex] = attendanceRecord;
    } else {
      console.log(`DEBUG: Pushing new attendance record for ${todayStr}`);
      employee.attendance.push(attendanceRecord);
    }

    await employee.save();
    // console.log(`DEBUG: Employee saved, attendance updated for ${todayStr}`);

    employee.password = undefined;

    res.status(200).json({
      message: "Clocked in successfully",
      employee: {
        _id: employee._id,
        employeeId: employee.employeeId,
        name: employee.name,
        loginTime: loginTime.toISOString(),
      },
    });
  } catch (error) {
    console.error(`DEBUG: Clock in error for employeeId ${employeeId}:`, error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const employeeClockOut = async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID or email is required" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const employee = await Employee.findOne({
      $or: [{ employeeId }, { email: employeeId }],
    });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const existingAttendanceIndex = employee.attendance.findIndex(
      (a) => new Date(a.date).toDateString() === today.toDateString()
    );

    if (existingAttendanceIndex === -1) {
      return res.status(400).json({
        message: "No attendance record found for today. Please clock in first.",
      });
    }

    const existingRecord = employee.attendance[existingAttendanceIndex];
    if (existingRecord.status !== "Present") {
      return res.status(400).json({
        message: `Cannot clock out: Status is ${existingRecord.status}`,
      });
    }

    if (existingRecord.logoutTime) {
      return res.status(400).json({
        message: "Already clocked out for today",
        logoutTime: existingRecord.logoutTime,
      });
    }

    const logoutTime = new Date();
    const loginTime = existingRecord.loginTime;

    if (!loginTime) {
      return res.status(400).json({
        message: "No login time found. Please clock in first.",
      });
    }

    if (logoutTime <= loginTime) {
      return res.status(400).json({
        message: "Logout time must be after login time",
      });
    }

    const diffMs = logoutTime - loginTime;
    const workingHours = (diffMs / (1000 * 60 * 60)).toFixed(2);

    existingRecord.logoutTime = logoutTime;
    existingRecord.workingHours = parseFloat(workingHours);

    await employee.save();
    employee.password = undefined;

    res.status(200).json({
      message: "Clocked out successfully",
      employee: {
        _id: employee._id,
        employeeId: employee.employeeId,
        name: employee.name,
        loginTime: loginTime.toISOString(),
        logoutTime: logoutTime.toISOString(),
        workingHours: parseFloat(workingHours),
      },
    });
  } catch (error) {
    console.error("Clock out error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getEmployeeAttendance = async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.body;

    // Validate input
    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID or email is required" });
    }

    // Find employee by ID or email
    const employee = await Employee.findOne({
      $or: [{ employeeId }, { email: employeeId }],
    }).select("-password"); // Exclude password from response

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Prepare date range filter
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      if (start > end) {
        return res.status(400).json({ message: "Start date must be before end date" });
      }

      dateFilter = {
        date: {
          $gte: start,
          $lte: end,
        },
      };
    }

    // Filter attendance records
    let attendanceRecords = employee.attendance;
    if (Object.keys(dateFilter).length > 0) {
      attendanceRecords = employee.attendance.filter((record) => {
        const recordDate = new Date(record.date);
        return recordDate >= dateFilter.date.$gte && recordDate <= dateFilter.date.$lte;
      });
    }

    // Sort attendance records by date (descending)
    attendanceRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Prepare response
    const response = {
      employee: {
        _id: employee._id,
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        designation: employee.designation,
        department: employee.department,
        joiningDate: employee.joiningDate,
      },
      attendance: attendanceRecords.map((record) => ({
        date: record.date.toISOString().split("T")[0],
        status: record.status,
        loginTime: record.loginTime ? record.loginTime.toISOString() : null,
        logoutTime: record.logoutTime ? record.logoutTime.toISOString() : null,
        workingHours: record.workingHours || null,
        whatsappSent: record.whatsappSent,
      })),
    };

    res.status(200).json({
      message: "Attendance records retrieved successfully",
      data: response,
    });
  } catch (error) {
    console.error("Get attendance error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const employeeAttendanceByAdmin = async (req, res) => {
  const { attendances, date, adminID } = req.body;

  console.log("req.body : ", req.body);

  try {
    if (!Array.isArray(attendances) || !date || !adminID) {
      return res.status(400).json({
        message:
          "Invalid input: attendances array, date, and adminID are required",
      });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    let presentCount = 0;
    let absentCount = 0;
    const absentEmployees = [];
    const results = [];

    for (const { employeeId, status, loginTime, logoutTime } of attendances) {
      if (
        !employeeId ||
        !["Present", "Absent", "Work From Home", "Leave"].includes(status)
      ) {
        results.push({ employeeId, message: "Invalid employeeId or status" });
        continue;
      }

      const employee = await Employee.findOne({ employeeId, adminID });
      if (!employee) {
        results.push({
          employeeId,
          message: "Employee not found under this admin",
        });
        continue;
      }

      // Validate loginTime and logoutTime for Present and Work From Home
      let parsedLoginTime, parsedLogoutTime, workingHours;
      if (status === "Present" || status === "Work From Home") {
        if (!loginTime || !logoutTime) {
          results.push({
            employeeId,
            message: "Login and logout times are required for Present or Work From Home status",
          });
          continue;
        }

        parsedLoginTime = new Date(`${date}T${loginTime}`);
        parsedLogoutTime = new Date(`${date}T${logoutTime}`);

        if (isNaN(parsedLoginTime) || isNaN(parsedLogoutTime)) {
          results.push({
            employeeId,
            message: "Invalid login or logout time format",
          });
          continue;
        }

        if (parsedLogoutTime <= parsedLoginTime) {
          results.push({
            employeeId,
            message: "Logout time must be after login time",
          });
          continue;
        }

        // Calculate working hours
        const diffMs = parsedLogoutTime - parsedLoginTime;
        workingHours = (diffMs / (1000 * 60 * 60)).toFixed(2); // Convert to hours
      }

      const existingAttendanceIndex = employee.attendance.findIndex(
        (a) => a.date.toDateString() === parsedDate.toDateString()
      );

      const attendanceRecord = {
        date: parsedDate,
        status,
        ...(status === "Present" || status === "Work From Home"
          ? { loginTime: parsedLoginTime, logoutTime: parsedLogoutTime, workingHours }
          : {}),
        whatsappSent: false,
      };

      if (existingAttendanceIndex !== -1) {
        employee.attendance[existingAttendanceIndex] = attendanceRecord;
      } else {
        employee.attendance.push(attendanceRecord);
      }

      await employee.save();

      if (status === "Present") {
        presentCount++;
      } else if (status === "Absent") {
        absentCount++;
        absentEmployees.push(employee);
      }

      results.push({ 
        employeeId, 
        message: "Attendance updated successfully",
        workingHours: workingHours || null
      });
    }

    let whatsappResults = [];
    if (absentEmployees.length > 0) {
      console.log("absentEmployees : ", absentEmployees);
      console.log(
        `Sending WhatsApp messages to ${absentEmployees.length} employees...`
      );
      whatsappResults = await Promise.all(
        absentEmployees.map(async (employee) => {
          const lastNotification = employee.attendance
            .filter((a) => a.status === "Absent")
            .find((a) => a.date.toDateString() === parsedDate.toDateString());
          if (lastNotification && lastNotification.whatsappSent) {
            return {
              employeeId: employee.employeeId,
              whatsappStatus: "Notification already sent for this date",
            };
          }

          if (!employee.mobileNo || !/^\d{10}$/.test(employee.mobileNo)) {
            console.error(
              `Invalid or missing mobile number for employee ${employee._id}: ${employee.mobileNo}`
            );
            return {
              employeeId: employee.employeeId,
              whatsappStatus:
                "Failed to send WhatsApp message: Invalid or missing mobile number",
            };
          }

          try {
            const message = `Dear ${
              employee.name
            },\n\nThis is to inform you that you have been marked *Absent* for the day on *${parsedDate
              .toISOString()
              .substring(
                0,
                10
              )}*. Please contact your reporting manager or HR for further clarification.\n\nRegards,\nANORG Technologies Pvt. Ltd.\nAviskar Apartment, Santaji Nagar, Gajanan Colony,\nNear Chauragade School, Gondia-441614, Maharashtra, India\nEmail: hr@anorgtechnology.com | Phone: +91-6260431226`;
            const response = await axios.get(
              "https://int.chatway.in/api/send-msg",
              {
                params: {
                  username: "anorg",
                  number: `91${employee.mobileNo}`,
                  message: message,
                  token: "enlkeG15cnlrdElSUkNzNk01ampydz09",
                },
              }
            );

            console.log(
              `WhatsApp API response for ${employee.mobileNo}:`,
              response.data
            );

            const attendanceIndex = employee.attendance.findIndex(
              (a) => a.date.toDateString() === parsedDate.toDateString()
            );
            if (attendanceIndex !== -1) {
              employee.attendance[attendanceIndex].whatsappSent = true;
              await employee.save();
            }

            return {
              employeeId: employee.employeeId,
              whatsappStatus: `WhatsApp notification sent successfully to ${employee.mobileNo}`,
            };
          } catch (error) {
            console.error(
              `Failed to send WhatsApp message to ${employee.mobileNo}:`,
              error.message,
              error.response?.data
            );
            return {
              employeeId: employee.employeeId,
              whatsappStatus: `Failed to send WhatsApp message: ${error.message}`,
            };
          }
        })
      );
    }

    return res.status(200).json({
      message: "Bulk attendance processed",
      results,
      whatsappResults,
      summary: {
        presentCount,
        absentCount,
        total: presentCount + absentCount,
        whatsappSent: whatsappResults.length > 0,
      },
    });
  } catch (error) {
    console.error("Bulk attendance error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

const bulkEmployeeRegister = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
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
      return res.status(400).json({
        message: `Excel file contains no sheets: ${file.originalname}`,
      });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    let data;
    try {
      data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (!data || data.length === 0) {
        return res.status(400).json({
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
      "employee id",
      "name",
      "email id",
      "password",
      "designation",
      "department",
      "skills",
      "mobile no",
      "joiningdate",
      "address",
    ];
    const requiredHeaders = [
      "employee id",
      "name",
      "email id",
      "designation",
      "department",
    ];
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

    const employeeIdIdx = headers.indexOf("employee id");
    const nameIdx = headers.indexOf("name");
    const emailIdx = headers.indexOf("email id");
    const designationIdx = headers.indexOf("designation");
    const departmentIdx = headers.indexOf("department");
    const skillsIdx = headers.indexOf("skills");
    const mobileNoIdx = headers.indexOf("mobile no");
    const joiningDateIdx = headers.indexOf("joiningdate");
    const addressIdx = headers.indexOf("address");

    const rows = data.slice(1);
    if (rows.length === 0) {
      return res.status(400).json({
        message: `Excel file contains no employee data: ${file.originalname}`,
      });
    }

    const registered = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const employeeId = row[employeeIdIdx]?.toString()?.trim();
      const name = row[nameIdx]?.toString()?.trim();
      let email =
        emailIdx !== -1 ? row[emailIdx]?.toString()?.trim() : undefined;
      const designation = row[designationIdx]?.toString()?.trim();
      const department = row[departmentIdx]?.toString()?.trim();
      const skills =
        skillsIdx !== -1 && row[skillsIdx]
          ? row[skillsIdx]
              .toString()
              .split(",")
              .map((s) => s.trim())
          : [];
      const mobileNo =
        mobileNoIdx !== -1 ? row[mobileNoIdx]?.toString()?.trim() : undefined;
      const joiningDate =
        joiningDateIdx !== -1 && row[joiningDateIdx]
          ? new Date(row[joiningDateIdx])
          : undefined;
      const address =
        addressIdx !== -1 ? row[addressIdx]?.toString()?.trim() : undefined;

      if (!employeeId || !name || !email || !designation || !department) {
        errors.push(
          `Row ${
            i + 2
          }: Missing required fields (employee id, name, email, designation, or department)`
        );
        continue;
      }

      if (!email.includes("@")) {
        email = `${email}@user`;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push(`Row ${i + 2}: Invalid email format: ${email}`);
        continue;
      }

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
        const existingEmployee = await Employee.findOne({
          $or: [{ email }, { employeeId }],
        });
        if (existingEmployee) {
          errors.push(
            `Row ${
              i + 2
            }: Email or Employee ID already exists: ${email} / ${employeeId}`
          );
          continue;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const employee = new Employee({
          employeeId,
          name,
          email,
          password: hashedPassword,
          designation,
          department,
          skills,
          mobileNo,
          joiningDate,
          address,
          role: "Employee",
          attendance: [],
        });

        const savedEmployee = await employee.save();

        registered.push({ employeeId, name, email, status: "Registered" });
      } catch (err) {
        errors.push(
          `Row ${i + 2}: Error registering employee ${name || email}: ${
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

const getAllEmployeeAttendance = async (req, res) => {
  try {
    const { period, date } = req.query;

    if (!period || !["daily", "weekly", "monthly"].includes(period)) {
      return res
        .status(400)
        .send({ message: "Invalid or missing period parameter" });
    }

    if (!date) {
      return res.status(400).send({ message: "Date parameter is required" });
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate)) {
      return res.status(400).send({ message: "Invalid date format" });
    }

    let startDate, endDate;
    if (period === "daily") {
      startDate = new Date(targetDate.setHours(0, 0, 0, 0));
      endDate = new Date(targetDate.setHours(23, 59, 59, 999));
    } else if (period === "weekly") {
      startDate = new Date(targetDate);
      startDate.setDate(targetDate.getDate() - targetDate.getDay());
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === "monthly") {
      startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      endDate = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth() + 1,
        0
      );
      endDate.setHours(23, 59, 59, 999);
    }

    const employees = await Employee.find({})
      .select("employeeId name email attendance")
      .lean();

    const dateList = [];
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      dateList.push(new Date(d).toISOString().substring(0, 10));
    }

    const attendanceData = employees.map((employee) => {
      const attendanceMap = {};
      dateList.forEach((date) => {
        const record = employee.attendance.find(
          (a) => new Date(a.date).toISOString().substring(0, 10) === date
        );
        attendanceMap[date] = record
          ? {
              status: record.status,
              loginTime: record.loginTime
                ? record.loginTime.toISOString().substring(11, 16)
                : null,
              logoutTime: record.logoutTime
                ? record.logoutTime.toISOString().substring(11, 16)
                : null,
              workingHours: record.workingHours || null,
            }
          : null;
      });

      return {
        _id: employee._id,
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        attendance: attendanceMap,
      };
    });

    const summary = {
      totalEmployees: attendanceData.length,
      totalPresent: attendanceData.reduce(
        (sum, employee) =>
          sum +
          Object.values(employee.attendance).filter(
            (a) => a && a.status === "Present"
          ).length,
        0
      ),
      totalAbsent: attendanceData.reduce(
        (sum, employee) =>
          sum +
          Object.values(employee.attendance).filter(
            (a) => a && a.status === "Absent"
          ).length,
        0
      ),
      totalWorkFromHome: attendanceData.reduce(
        (sum, employee) =>
          sum +
          Object.values(employee.attendance).filter(
            (a) => a && a.status === "Work From Home"
          ).length,
        0
      ),
      totalLeave: attendanceData.reduce(
        (sum, employee) =>
          sum +
          Object.values(employee.attendance).filter(
            (a) => a && a.status === "Leave"
          ).length,
        0
      ),
      totalWorkingHours: attendanceData.reduce(
        (sum, employee) =>
          sum +
          Object.values(employee.attendance).reduce(
            (sumHours, record) =>
              sumHours + (record && record.workingHours ? parseFloat(record.workingHours) : 0),
            0
          ),
        0
      ).toFixed(2),
      period,
      startDate,
      endDate,
      dateList,
    };

    res.status(200).send({ attendanceData, summary });
  } catch (err) {
    console.error("Attendance fetch error:", err);
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

module.exports = {
  employeeRegister,
  employeeLogIn,
  getEmployeeDetail,
  getAllEmployeesByAdmin,
  employeeAttendanceByAdmin,
  bulkEmployeeRegister,
  getAllEmployeeAttendance,
  employeeClockIn,
  employeeClockOut,
  getEmployeeAttendance,
};