const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const Teacher = require('../models/teacherSchema.js');
const Batch = require('../models/batchSchema.js');
const Intern = require('../models/internSchema.js');

const teacherRegister = async (req, res) => {
    const { name, email, password, role, batchId } = req.body;

    try {
        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        // Check if email already exists
        const existingTeacherByEmail = await Teacher.findOne({ email });
        if (existingTeacherByEmail) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(password, salt);

        // Create new teacher
        const teacher = new Teacher({
            name,
            email,
            password: hashedPass,
            role: role || 'Teacher',
            teachBatches: batchId ? [batchId] : []
        });

        // Save teacher
        const savedTeacher = await teacher.save();

        // If batchId is provided, update the batch's teacher field
        if (batchId) {
            const batch = await Batch.findById(batchId);
            if (!batch) {
                return res.status(404).json({ message: 'Batch not found' });
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
        res.status(500).json({ message: 'Server error' });
    }
};

const teacherLogIn = async (req, res) => {
    try {
        let teacher = await Teacher.findOne({ email: req.body.email });
        if (teacher) {
            const validated = await bcrypt.compare(req.body.password, teacher.password);
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
        let teachers = await Teacher.find()
            .populate("teachBatches", "batchName");
        
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
        let teacher = await Teacher.findById(req.params.id)
            .populate("teachBatches");
        
        if (teacher) {
            teacher.password = undefined;
            res.send(teacher);
        }
        else {
            res.send({ message: "No teacher found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
}

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
        await Batch.findByIdAndUpdate(
            batchId, 
            { teacher: teacherId }
        );

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
        await Batch.findByIdAndUpdate(
            batchId,
            { $unset: { teacher: "" } }
        );

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
            await Teacher.findByIdAndUpdate(
                teacher._id,
                { $pull: { teachBatches: batchId } }
            );
        }

        res.send({ message: `Batch removed from ${teachers.length} teachers` });
    } catch (error) {
        res.status(500).json(error);
    }
};

const createTransporter = () => {
    // Check if environment variables are properly set
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('Email credentials not found in environment variables');
        console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'Set' : 'Not set');
        console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set' : 'Not set');
        return null;
    }

    return nodemailer.createTransporter({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        // Add additional options for better reliability
        secure: true,
        port: 465,
        tls: {
            rejectUnauthorized: false
        }
    });
};

// Function to send absence email
const sendAbsenceEmail = async (intern, batch, date) => {
    const transporter = createTransporter();
    
    if (!transporter) {
        console.error('Cannot create email transporter - missing credentials');
        return { 
            internId: intern._id, 
            emailStatus: 'Failed to send email: Missing email credentials' 
        };
    }

    const mailOptions = {
        from: `"Attendance System" <${process.env.EMAIL_USER}>`,
        to: intern.email,
        subject: `Absence Notification for ${batch.batchName} on ${new Date(date).toISOString().substring(0, 10)}`,
        html: `
            <h3>Dear ${intern.name},</h3>
            <p>You were marked <strong>Absent</strong> for the following batch:</p>
            <ul>
                <li><strong>Batch:</strong> ${batch.batchName}</li>
                <li><strong>Subject:</strong> ${batch.subject}</li>
                <li><strong>Date:</strong> ${new Date(date).toISOString().substring(0, 10)}</li>
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
        return { internId: intern._id, emailStatus: 'Email sent successfully' };
    } catch (error) {
        console.error(`Failed to send email to ${intern.email}:`, error.message);
        return { 
            internId: intern._id, 
            emailStatus: `Failed to send email: ${error.message}` 
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
                message: 'Invalid input: attendances array, date, and batchId are required' 
            });
        }

        // Parse date once
        const parsedDate = new Date(date);
        if (isNaN(parsedDate)) {
            return res.status(400).json({ message: 'Invalid date format' });
        }

        // Fetch batch details for email content
        const batch = await Batch.findById(batchId);
        if (!batch) {
            return res.status(404).json({ message: 'Batch not found' });
        }

        // Track counts for teacher's attendance record
        let presentCount = 0;
        let absentCount = 0;

        // Collect absent interns for email notifications
        const absentInterns = [];

        const results = [];
        for (const { internId, status } of attendances) {
            if (!internId || !['Present', 'Absent'].includes(status)) {
                results.push({ internId, message: 'Invalid internId or status' });
                continue;
            }

            // Update intern's attendance
            const intern = await Intern.findById(internId);
            if (!intern) {
                results.push({ internId, message: 'Intern not found' });
                continue;
            }

            // Check for existing attendance entry on this date
            const existingAttendanceIndex = intern.attendance.findIndex(
                a => a.date.toDateString() === parsedDate.toDateString()
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
            if (status === 'Present') {
                presentCount++;
            } else {
                absentCount++;
                absentInterns.push(intern); // Collect absent interns
            }

            results.push({ internId, message: 'Attendance updated successfully' });
        }

        // Send emails to absent interns (only if email credentials are available)
        let emailResults = [];
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS && absentInterns.length > 0) {
            console.log(`Sending absence emails to ${absentInterns.length} interns...`);
            emailResults = await Promise.all(
                absentInterns.map(intern => sendAbsenceEmail(intern, batch, parsedDate))
            );
        } else if (absentInterns.length > 0) {
            console.warn('Email credentials not configured. Skipping email notifications.');
            emailResults = absentInterns.map(intern => ({
                internId: intern._id,
                emailStatus: 'Email skipped: credentials not configured'
            }));
        }

        // Update teacher's attendance summary for this date
        if (batch.teacher) {
            const teacher = await Teacher.findById(batch.teacher);
            if (teacher) {
                const existingTeacherAttendanceIndex = teacher.attendance.findIndex(
                    a => a.date.toDateString() === parsedDate.toDateString()
                );

                if (existingTeacherAttendanceIndex !== -1) {
                    teacher.attendance[existingTeacherAttendanceIndex].presentCount = presentCount;
                    teacher.attendance[existingTeacherAttendanceIndex].absentCount = absentCount;
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
            message: 'Bulk attendance processed',
            results,
            emailResults,
            summary: { 
                presentCount, 
                absentCount, 
                total: presentCount + absentCount,
                emailsConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
            },
        });
    } catch (error) {
        console.error('Bulk attendance error:', error);
        res.status(500).json({ 
            message: 'Server error', 
            error: error.message 
        });
    }
};

const getBatchAttendance = async (req, res) => {
    const { batchId } = req.params;
    const { date } = req.query;

    try {
        if (!batchId || !date) {
            return res.status(400).json({ message: 'BatchId and date are required' });
        }

        const parsedDate = new Date(date);
        if (isNaN(parsedDate)) {
            return res.status(400).json({ message: 'Invalid date format' });
        }

        // Find batch and check if it exists
        const batch = await Batch.findById(batchId).populate('students');
        if (!batch) {
            return res.status(404).json({ message: 'Batch not found' });
        }

        // Get all interns in this batch
        const internIds = batch.students;
        const interns = await Intern.find({ _id: { $in: internIds } });

        // Create attendance records
        const attendanceRecords = interns.map(intern => {
            const attendance = intern.attendance.find(
                a => a.date.toDateString() === parsedDate.toDateString()
            );
            
            return {
                internId: intern._id,
                name: intern.name,
                email: intern.email,
                status: attendance ? attendance.status : 'Not Marked'
            };
        });

        res.status(200).json(attendanceRecords);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
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
    getBatchAttendance
};