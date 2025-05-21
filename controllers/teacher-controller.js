const bcrypt = require('bcrypt');
const Teacher = require('../models/teacherSchema.js');
const Batch = require('../models/batchSchema.js');
const Intern = require('../models/internSchema.js');

const teacherRegister = async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(password, salt);

        const teacher = new Teacher({ 
            name, 
            email, 
            password: hashedPass, 
            role: role || "Teacher",
            teachBatches: []
        });

        const existingTeacherByEmail = await Teacher.findOne({ email });

        if (existingTeacherByEmail) {
            res.send({ message: 'Email already exists' });
        }
        else {
            let result = await teacher.save();
            result.password = undefined;
            res.send(result);
        }
    } catch (err) {
        res.status(500).json(err);
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

const bulkInternAttendance = async (req, res) => {
    const { attendances, date, batchId } = req.body;

    try {
        // Validate input
        if (!Array.isArray(attendances) || !date || !batchId) {
            return res.status(400).json({ message: 'Invalid input: attendances array, date, and batchId are required' });
        }

        // Parse date once
        const parsedDate = new Date(date);
        if (isNaN(parsedDate)) {
            return res.status(400).json({ message: 'Invalid date format' });
        }

        // Track counts for teacher's attendance record
        let presentCount = 0;
        let absentCount = 0;

        const results = [];
        for (const { internId, status } of attendances) {
            if (!internId || !['Present', 'Absent'].includes(status)) {
                continue; // Skip invalid entries
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
                    status
                });
            }

            await intern.save();
            
            // Update counts for teacher record
            if (status === 'Present') presentCount++;
            else absentCount++;
            
            results.push({ internId, message: 'Attendance updated successfully' });
        }

        // Update teacher's attendance summary for this date
        const batch = await Batch.findById(batchId);
        if (batch && batch.teacher) {
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
                        absentCount
                    });
                }
                
                await teacher.save();
            }
        }

        return res.status(200).json({ 
            message: 'Bulk attendance processed', 
            results,
            summary: { presentCount, absentCount, total: presentCount + absentCount }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
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