const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const Teacher = require("../models/teacherSchema.js");
const Batch = require("../models/batchSchema.js");
const Intern = require("../models/internSchema.js");

const teacherRegister = async (req, res) => {
  const { name, email, password, role, batchId } = req.body;

  try {
    // Validate required fields
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    // Check if email already exists
    const existingTeacherByEmail = await Teacher.findOne({ email });
    if (existingTeacherByEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(password, salt);

    // Create new teacher
    const teacher = new Teacher({
      name,
      email,
      password: hashedPass,
      role: role || "Teacher",
      teachBatches: batchId ? [batchId] : [],
    });

    // Save teacher
    const savedTeacher = await teacher.save();

    // If batchId is provided, update the batch's teacher field
    if (batchId) {
      const batch = await Batch.findById(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }
      batch.teacher = savedTeacher._id;
      await batch.save();
    }

    // Remove password from response
    const teacherResponse = savedTeacher.toObject();
    delete teacherResponse.password;

    res.status(201).json(teacherResponse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const teacherLogIn = async (req, res) => {
  try {
    let teacher = await Teacher.findOne({ email: req.body.email });
    if (teacher) {
      const validated = await bcrypt.compare(
        req.body.password,
        teacher.password
      );
      if (validated) {
        teacher = await teacher.populate("teachBatches");
        teacher.password = undefined;
        res.send(teacher);
      } else {
        res.send({ message: "Invalid password" });
      }
    } else {
      res.send({ message: "Teacher not found" });
    }
  } catch (err) {
    res.status(500).json(err);
  }
};

const getTeachers = async (req, res) => {
  try {
    let teachers = await Teacher.find().populate("teachBatches", "batchName");

    if (teachers.length > 0) {
      let modifiedTeachers = teachers.map((teacher) => {
        return { ...teacher._doc, password: undefined };
      });
      res.send(modifiedTeachers);
    } else {
      res.send({ message: "No teachers found" });
    }
  } catch (err) {
    res.status(500).json(err);
  }
};

const getTeacherDetail = async (req, res) => {
  try {
    let teacher = await Teacher.findById(req.params.id).populate(
      "teachBatches"
    );

    if (teacher) {
      teacher.password = undefined;
      res.send(teacher);
    } else {
      res.send({ message: "No teacher found" });
    }
  } catch (err) {
    res.status(500).json(err);
  }
};

const assignBatchToTeacher = async (req, res) => {
  const { teacherId, batchId } = req.body;
  try {
    // Update teacher with new batch
    const updatedTeacher = await Teacher.findByIdAndUpdate(
      teacherId,
      { $addToSet: { teachBatches: batchId } },
      { new: true }
    );

    // Update batch with teacher reference
    await Batch.findByIdAndUpdate(batchId, { teacher: teacherId });

    res.send(updatedTeacher);
  } catch (error) {
    res.status(500).json(error);
  }
};

const removeBatchFromTeacher = async (req, res) => {
  const { teacherId, batchId } = req.body;
  try {
    // Remove batch from teacher
    const updatedTeacher = await Teacher.findByIdAndUpdate(
      teacherId,
      { $pull: { teachBatches: batchId } },
      { new: true }
    );

    // Remove teacher reference from batch
    await Batch.findByIdAndUpdate(batchId, { $unset: { teacher: "" } });

    res.send(updatedTeacher);
  } catch (error) {
    res.status(500).json(error);
  }
};

const deleteTeacher = async (req, res) => {
  try {
    const deletedTeacher = await Teacher.findByIdAndDelete(req.params.id);

    if (!deletedTeacher) {
      return res.status(404).send({ message: "Teacher not found" });
    }

    // Update batches to remove teacher reference
    await Batch.updateMany(
      { teacher: deletedTeacher._id },
      { $unset: { teacher: "" } }
    );

    res.send(deletedTeacher);
  } catch (error) {
    res.status(500).json(error);
  }
};

const deleteTeachersByBatch = async (req, res) => {
  const { batchId } = req.params;
  try {
    // Find teachers associated with this batch
    const teachers = await Teacher.find({ teachBatches: batchId });

    // For each teacher, remove this batch from their teachBatches array
    for (const teacher of teachers) {
      await Teacher.findByIdAndUpdate(teacher._id, {
        $pull: { teachBatches: batchId },
      });
    }

    res.send({ message: `Batch removed from ${teachers.length} teachers` });
  } catch (error) {
    res.status(500).json(error);
  }
};

// Function to create email transporter
const createTransporter = () => {
  // Check if environment variables are properly set
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("Email credentials not found in environment variables");
    console.log("EMAIL_USER:", process.env.EMAIL_USER ? "Set" : "Not set");
    console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "Set" : "Not set");
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    secure: true,
    port: 465,
    tls: {
      rejectUnauthorized: false, // Note: Use with caution in production
    },
  });
};

// Function to send absence email
const sendAbsenceEmail = async (intern, batch, date) => {
  const transporter = createTransporter();

  if (!transporter) {
    console.error("Cannot create email transporter - missing credentials");
    return {
      internId: intern._id,
      emailStatus: "Failed to send email: Missing email credentials",
    };
  }

  const mailOptions = {
    from: `"Attendance System" <${process.env.EMAIL_USER}>`,
    to: intern.email,
    subject: `Absence Notification for ${batch.batchName} on ${new Date(date)
      .toISOString()
      .substring(0, 10)}`,
    html: `
            <h3>Dear ${intern.name},</h3>
            <p>You were marked <strong>Absent</strong> for the following batch:</p>
            <ul>
                <li><strong>Batch:</strong> ${batch.batchName}</li>
                <li><strong>Subject:</strong> ${batch.subject}</li>
                <li><strong>Date:</strong> ${new Date(date)
                  .toISOString()
                  .substring(0, 10)}</li>
                <li><strong>Time:</strong> ${batch.time}</li>
                <li><strong>Location:</strong> ${batch.location}</li>
            </ul>
            <p>Please contact your instructor or administrator if you have any questions.</p>
            <p>Best regards, <br>ANORG Technology Pvt. Ltd.</p>
        `,
  };

  try {
    // Verify transporter before sending
    await transporter.verify();
    await transporter.sendMail(mailOptions);
    return { internId: intern._id, emailStatus: "Email sent successfully" };
  } catch (error) {
    console.error(`Failed to send email to ${intern.email}:`, error.message);
    return {
      internId: intern._id,
      emailStatus: `Failed to send email: ${error.message}`,
    };
  }
};

const bulkInternAttendance = async (req, res) => {
  const { attendances, date, batchId } = req.body;

  // Debug environment variables
  console.log("EMAIL_USER exists:", !!process.env.EMAIL_USER);
  console.log("EMAIL_PASS exists:", !!process.env.EMAIL_PASS);

  try {
    // Validate input
    if (!Array.isArray(attendances) || !date || !batchId) {
      return res.status(400).json({
        message:
          "Invalid input: attendances array, date, and batchId are required",
      });
    }

    // Parse date once
    const parsedDate = new Date(date);
    if (isNaN(parsedDate)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // Fetch batch details for email content
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Track counts for teacher's attendance record
    let presentCount = 0;
    let absentCount = 0;

    // Collect absent interns for email notifications
    const absentInterns = [];

    const results = [];
    for (const { internId, status } of attendances) {
      if (!internId || !["Present", "Absent"].includes(status)) {
        results.push({ internId, message: "Invalid internId or status" });
        continue;
      }

      // Update intern's attendance
      const intern = await Intern.findById(internId);
      if (!intern) {
        results.push({ internId, message: "Intern not found" });
        continue;
      }

      // Check for existing attendance entry on this date
      const existingAttendanceIndex = intern.attendance.findIndex(
        (a) => a.date.toDateString() === parsedDate.toDateString()
      );

      if (existingAttendanceIndex !== -1) {
        intern.attendance[existingAttendanceIndex].status = status;
      } else {
        intern.attendance.push({
          date: parsedDate,
          status,
        });
      }

      await intern.save();

      // Update counts for teacher record
      if (status === "Present") {
        presentCount++;
      } else {
        absentCount++;
        absentInterns.push(intern); // Collect absent interns
      }

      results.push({ internId, message: "Attendance updated successfully" });
    }

    // Send emails to absent interns (only if email credentials are available)
    let emailResults = [];
    if (
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASS &&
      absentInterns.length > 0
    ) {
      console.log(
        `Sending absence emails to ${absentInterns.length} interns...`
      );
      emailResults = await Promise.all(
        absentInterns.map((intern) =>
          sendAbsenceEmail(intern, batch, parsedDate)
        )
      );
    } else if (absentInterns.length > 0) {
      console.warn(
        "Email credentials not configured. Skipping email notifications."
      );
      emailResults = absentInterns.map((intern) => ({
        internId: intern._id,
        emailStatus: "Email skipped: credentials not configured",
      }));
    }

    // Update teacher's attendance summary for this date
    if (batch.teacher) {
      const teacher = await Teacher.findById(batch.teacher);
      if (teacher) {
        const existingTeacherAttendanceIndex = teacher.attendance.findIndex(
          (a) => a.date.toDateString() === parsedDate.toDateString()
        );

        if (existingTeacherAttendanceIndex !== -1) {
          teacher.attendance[existingTeacherAttendanceIndex].presentCount =
            presentCount;
          teacher.attendance[existingTeacherAttendanceIndex].absentCount =
            absentCount;
        } else {
          teacher.attendance.push({
            date: parsedDate,
            presentCount,
            absentCount,
          });
        }

        await teacher.save();
      }
    }

    return res.status(200).json({
      message: "Bulk attendance processed",
      results,
      emailResults,
      summary: {
        presentCount,
        absentCount,
        total: presentCount + absentCount,
        emailsConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
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

const getBatchAttendance = async (req, res) => {
  const { batchId } = req.params;
  const { date } = req.query;

  try {
    if (!batchId || !date) {
      return res.status(400).json({ message: "BatchId and date are required" });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // Find batch and check if it exists
    const batch = await Batch.findById(batchId).populate("students");
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Get all interns in this batch
    const internIds = batch.students;
    const interns = await Intern.find({ _id: { $in: internIds } });

    // Create attendance records
    const attendanceRecords = interns.map((intern) => {
      const attendance = intern.attendance.find(
        (a) => a.date.toDateString() === parsedDate.toDateString()
      );

      return {
        internId: intern._id,
        name: intern.name,
        email: intern.email,
        status: attendance ? attendance.status : "Not Marked",
      };
    });

    res.status(200).json(attendanceRecords);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const cloudinary = require("cloudinary").v2;
const mongoose = require("mongoose");
const fs = require("fs").promises; // For file cleanup

// Import your models
const Notes = require("../models/notesModel.js"); // Adjust path as needed
// const Batch = require("../models/batch"); // Adjust path as needed

const addNotes = async (req, res) => {
  // Configure Cloudinary (should be in a config file)
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  console.log(
    " cloud_name:",
    process.env.CLOUDINARY_CLOUD_NAME,
    "api_key:",
    process.env.CLOUDINARY_API_KEY,
    " api_secret: ",
    process.env.CLOUDINARY_API_SECRET
  );

  try {
    const { batchId, title, content } = req.body;
    const file = req.file; // Assuming file is sent via multipart/form-data

    console.log("Received request:", {
      batchId,
      title,
      content,
      file: file
        ? {
            originalname: file.originalname,
            filename: file.filename,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
          }
        : "No file",
    });

    // Validate required fields
    if (!batchId || !title || !content) {
      console.error("Validation failed: Missing required fields");
      return res.status(400).json({
        message: "Batch ID, title, and content are required",
      });
    }

    // Check Cloudinary configuration if file is provided
    if (
      file &&
      (!process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET)
    ) {
      console.error("Cloudinary environment variables not set");
      return res.status(500).json({
        message:
          "Cloudinary configuration is missing. Please check environment variables.",
      });
    }

    // Verify batch exists and get the assigned teacher
    const batch = await Batch.findById(batchId).populate("teacher");
    if (!batch) {
      console.error("Batch not found:", batchId);
      return res.status(404).json({
        message: "Batch not found",
      });
    }

    // Check if batch has a teacher assigned
    if (!batch.teacher) {
      console.error("No teacher assigned to batch:", batchId);
      return res.status(400).json({
        message: "No teacher is assigned to this batch",
      });
    }

    // Get the teacher ID from the batch
    const teacherId = batch.teacher._id;
    console.log("Teacher found for batch:", {
      teacherId: teacherId.toString(),
      teacherName: batch.teacher.name || "N/A",
      batchName: batch.batchName,
    });

    // Upload file to Cloudinary if provided
    let fileUrl = {};
    if (file) {
      try {
        console.log("Uploading file to Cloudinary...");
        console.log("File details:", {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          hasBuffer: !!file.buffer,
        });

        // Check if file buffer exists (since we're using memoryStorage)
        if (!file.buffer) {
          throw new Error(
            "File buffer is missing - multer memoryStorage issue"
          );
        }

        // Upload using file buffer (memoryStorage stores files as buffers)
        console.log("Uploading using file buffer from memoryStorage...");
        const base64String = `data:${
          file.mimetype
        };base64,${file.buffer.toString("base64")}`;

        const result = await cloudinary.uploader.upload(base64String, {
          folder: "notes",
          resource_type: "auto",
          public_id: `note_${Date.now()}_${file.originalname.split(".")[0]}`,
        });

        fileUrl = {
          public_id: result.public_id,
          url: result.secure_url,
        };

        // No need to clean up temporary files since we're using memoryStorage
        console.log(
          "File uploaded successfully to Cloudinary:",
          result.secure_url
        );
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        console.error("Upload error details:", {
          message: uploadError.message,
          stack: uploadError.stack,
          originalName: file?.originalname,
          hasBuffer: !!file?.buffer,
        });

        return res.status(500).json({
          message: "Error uploading file to Cloudinary",
          error: uploadError.message,
          details: {
            originalName: file?.originalname,
            size: file?.size,
            hasBuffer: !!file?.buffer,
          },
        });
      }
    }

    // Create new note
    const newNote = await Notes.create({
      batch: batchId,
      title,
      content,
      fileUrl: Object.keys(fileUrl).length ? fileUrl : undefined,
      uploadedBy: teacherId,
    });

    console.log("Note created successfully with ID:", newNote._id.toString());

    // Add note reference to batch
    batch.notes.push(newNote._id);
    await batch.save();

    console.log("Note reference added to batch");

    // Populate batch and teacher details for response
    const populatedNote = await Notes.findById(newNote._id)
      .populate("batch", "batchName subject")
      .populate("uploadedBy", "name email");

    console.log("Note populated and ready for response");

    res.status(201).json({
      success: true,
      message: "Note added successfully",
      note: populatedNote,
    });
  } catch (err) {
    console.error("Error in addNotes:", err.message);
    console.error("Stack trace:", err.stack);
    res.status(500).json({
      success: false,
      message: "Error adding note",
      error: err.message,
    });
  }
};

const getNotes = async (req, res) => {
  try {
    const { batchId } = req.query;
    let query = {};

    // If batchId is provided, filter by batch
    if (batchId) {
      // Verify batch exists
      const batch = await Batch.findById(batchId);
      if (!batch) {
        return res.status(404).json({
          success: false,
          message: "Batch not found",
        });
      }
      query.batch = batchId;
    }

    console.log("Fetching notes with query:", query);

    // Get notes with populated fields
    const notes = await Notes.find(query)
      .populate("batch", "batchName subject")
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 }); // Sort by newest first

    console.log(`Found ${notes.length} notes`);

    res.status(200).json({
      success: true,
      message: "Notes retrieved successfully",
      count: notes.length,
      notes: notes,
    });
  } catch (err) {
    console.error("Error in getNotes:", err.message);
    console.error("Stack trace:", err.stack);
    res.status(500).json({
      success: false,
      message: "Error fetching notes",
      error: err.message,
    });
  }
};

// Update note
const updateNotes = async (req, res) => {
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  try {
    const { noteId } = req.params;
    const { title, content } = req.body;
    const file = req.file; // New file if provided

    console.log("Updating note:", noteId, { title, content, hasFile: !!file });

    // Find the existing note
    const existingNote = await Notes.findById(noteId);
    if (!existingNote) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    // Check Cloudinary configuration if file is provided
    if (
      file &&
      (!process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET)
    ) {
      console.error("Cloudinary environment variables not set");
      return res.status(500).json({
        message:
          "Cloudinary configuration is missing. Please check environment variables.",
      });
    }

    // Prepare update object
    const updateData = {};
    if (title) updateData.title = title;
    if (content) updateData.content = content;

    // Handle file upload if new file is provided
    if (file) {
      try {
        console.log("Uploading new file to Cloudinary...");

        // Delete old file from Cloudinary if it exists
        if (existingNote.fileUrl && existingNote.fileUrl.public_id) {
          console.log(
            "Deleting old file from Cloudinary:",
            existingNote.fileUrl.public_id
          );
          await cloudinary.uploader.destroy(existingNote.fileUrl.public_id);
        }

        // Check if file buffer exists
        if (!file.buffer) {
          throw new Error(
            "File buffer is missing - multer memoryStorage issue"
          );
        }

        // Upload new file
        const base64String = `data:${
          file.mimetype
        };base64,${file.buffer.toString("base64")}`;

        const result = await cloudinary.uploader.upload(base64String, {
          folder: "notes",
          resource_type: "auto",
          public_id: `note_${Date.now()}_${file.originalname.split(".")[0]}`,
        });

        updateData.fileUrl = {
          public_id: result.public_id,
          url: result.secure_url,
        };

        console.log(
          "New file uploaded successfully to Cloudinary:",
          result.secure_url
        );
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Error uploading file to Cloudinary",
          error: uploadError.message,
        });
      }
    }

    // Update the note
    const updatedNote = await Notes.findByIdAndUpdate(noteId, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("batch", "batchName subject")
      .populate("uploadedBy", "name email");

    console.log("Note updated successfully:", updatedNote.title);

    res.status(200).json({
      success: true,
      message: "Note updated successfully",
      note: updatedNote,
    });
  } catch (err) {
    console.error("Error in updateNotes:", err.message);
    console.error("Stack trace:", err.stack);
    res.status(500).json({
      success: false,
      message: "Error updating note",
      error: err.message,
    });
  }
};

// Delete note
const deleteNotes = async (req, res) => {
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  try {
    const { noteId } = req.params;

    console.log("Deleting note with ID:", noteId);

    // Find the note to delete
    const noteToDelete = await Notes.findById(noteId);
    if (!noteToDelete) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    console.log("Found note to delete:", noteToDelete.title);

    // Delete file from Cloudinary if it exists
    if (noteToDelete.fileUrl && noteToDelete.fileUrl.public_id) {
      try {
        console.log(
          "Deleting file from Cloudinary:",
          noteToDelete.fileUrl.public_id
        );
        await cloudinary.uploader.destroy(noteToDelete.fileUrl.public_id);
        console.log("File deleted from Cloudinary successfully");
      } catch (cloudinaryError) {
        console.error("Error deleting file from Cloudinary:", cloudinaryError);
        // Continue with note deletion even if Cloudinary deletion fails
      }
    }

    // Remove note reference from batch
    try {
      const batch = await Batch.findById(noteToDelete.batch);
      if (batch) {
        batch.notes = batch.notes.filter(
          (noteId) => noteId.toString() !== noteToDelete._id.toString()
        );
        await batch.save();
        console.log("Note reference removed from batch");
      }
    } catch (batchError) {
      console.error("Error removing note reference from batch:", batchError);
      // Continue with note deletion even if batch update fails
    }

    // Delete the note from database
    await Notes.findByIdAndDelete(noteId);

    console.log("Note deleted successfully from database");

    res.status(200).json({
      success: true,
      message: "Note deleted successfully",
      deletedNote: {
        id: noteToDelete._id,
        title: noteToDelete.title,
      },
    });
  } catch (err) {
    console.error("Error in deleteNotes:", err.message);
    console.error("Stack trace:", err.stack);
    res.status(500).json({
      success: false,
      message: "Error deleting note",
      error: err.message,
    });
  }
};

module.exports = {
  teacherRegister,
  teacherLogIn,
  getTeachers,
  getTeacherDetail,
  assignBatchToTeacher,
  removeBatchFromTeacher,
  deleteTeacher,
  deleteTeachersByBatch,
  bulkInternAttendance,
  getBatchAttendance,
  addNotes,
  getNotes,
  updateNotes,
  deleteNotes,
};
