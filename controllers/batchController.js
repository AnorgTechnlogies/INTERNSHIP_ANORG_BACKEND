const Batch = require('../models/batchSchema.js');
const Intern = require('../models/internSchema.js');
const Teacher = require('../models/teacherSchema.js');

// Create a new batch
const batchCreate = async (req, res) => {
    console.log("Request body:", req.body);
    try {
        // Validate required fields
        const requiredFields = [
            "batchName",
            "scheduleTitle",
            "modeOfBatch",
            "sequenceNumber",
            "location",
            "subject",
            "duration",
            "startDate",
            "endDate",
            "time",
        ];
        for (const field of requiredFields) {
            if (!req.body[field]) {
                return res.status(400).json({ message: `Missing required field: ${field}` });
            }
        }

        // Check for existing batch with same name and sequence number
        const existingBatchByName = await Batch.findOne({
            batchName: req.body.batchName,
            sequenceNumber: req.body.sequenceNumber,
        });

        if (existingBatchByName) {
            return res.status(400).json({
                message: "Sorry, this batch name with the same sequence number already exists",
            });
        }

        // Create new batch
        const batch = new Batch({
            batchName: req.body.batchName,
            scheduleTitle: req.body.scheduleTitle,
            modeOfBatch: req.body.modeOfBatch,
            sequenceNumber: req.body.sequenceNumber,
            location: req.body.location,
            subject: req.body.subject,
            duration: req.body.duration,
            startDate: new Date(req.body.startDate),
            endDate: new Date(req.body.endDate),
            time: req.body.time,
            description: req.body.description,
            // teacher: Not included since it's optional
            // students: Defaults to empty array
            // status: Defaults to "Upcoming"
        });

        const result = await batch.save();
        res.status(201).json(result);
    } catch (err) {
        console.error("Error creating batch:", err);
        res.status(500).json({
            message: "Server error",
            error: err.message,
            stack: err.stack, // Include stack trace for debugging
        });
    }
};

const batchList = async (req, res) => {
    try {
        // If filtering by admin is needed, you can add that filter here
        let batches = await Batch.find();
        if (batches.length > 0) {
            res.send(batches);
        } else {
            res.send({ message: "No batches found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const getBatchDetail = async (req, res) => {
    try {
        let batch = await Batch.findById(req.params.id);
        if (batch) {
            batch = await batch.populate("teacher", "name");
            res.send(batch);
        }
        else {
            res.send({ message: "No batch found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const getBatchInterns = async (req, res) => {
    try {
        // Find interns that have this batch ID in their batches array
        let interns = await Intern.find({ batches: { $in: [req.params.id] } });
        if (interns.length > 0) {
            let modifiedInterns = interns.map((intern) => {
                return { ...intern._doc, password: undefined };
            });
            res.send(modifiedInterns);
        } else {
            res.send({ message: "No interns found in this batch" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const deleteBatch = async (req, res) => {
    try {
        const deletedBatch = await Batch.findByIdAndDelete(req.params.id);
        if (!deletedBatch) {
            return res.send({ message: "Batch not found" });
        }

        // Remove this batch from all interns' batches array
        await Intern.updateMany(
            { batches: req.params.id },
            { $pull: { batches: req.params.id } }
        );

        // If you have related subject documents, remove them
        // await Subject.deleteMany({ batch: req.params.id });

        // If teachers are exclusively assigned to this batch, handle accordingly
        // For now, we'll just return the deleted batch info
        res.send(deletedBatch);
    } catch (error) {
        res.status(500).json(error);
    }
};

const deleteBatches = async (req, res) => {
    try {
        // This function needs to be adjusted based on your requirements
        // Are you deleting batches by some criteria?
        const deletedBatches = await Batch.deleteMany({});
        if (deletedBatches.deletedCount === 0) {
            return res.send({ message: "No batches found to delete" });
        }

        // Update all interns to remove these batches
        await Intern.updateMany(
            {},
            { $set: { batches: [] } }
        );

        res.send(deletedBatches);
    } catch (error) {
        res.status(500).json(error);
    }
};

// New functions specific to batch management
const updateBatchStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['Upcoming', 'Ongoing', 'Completed', 'Cancelled'].includes(status)) {
            return res.status(400).send({ message: "Invalid batch status" });
        }

        const updatedBatch = await Batch.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!updatedBatch) {
            return res.status(404).send({ message: "Batch not found" });
        }

        res.send(updatedBatch);
    } catch (error) {
        res.status(500).json(error);
    }
};

const assignInternToBatch = async (req, res) => {
    try {
        const { batchId, internId } = req.body;

        // Check if batch exists
        const batch = await Batch.findById(batchId);
        if (!batch) {
            return res.status(404).send({ message: "Batch not found" });
        }

        // Check if intern exists
        const intern = await Intern.findById(internId);
        if (!intern) {
            return res.status(404).send({ message: "Intern not found" });
        }

        // Check if intern is already assigned to this batch
        if (intern.batches.includes(batchId)) {
            return res.send({ message: "Intern is already assigned to this batch" });
        }

        // Add batch to intern's batches
        intern.batches.push(batchId);
        await intern.save();

        // Add intern to batch's students
        if (!batch.students.includes(internId)) {
            batch.students.push(internId);
            await batch.save();
        }

        res.send({ message: "Intern successfully assigned to batch", intern, batch });
    } catch (error) {
        res.status(500).json(error);
    }
};

const removeInternFromBatch = async (req, res) => {
    try {
        const { batchId, internId } = req.body;

        // Remove batch from intern's batches
        await Intern.findByIdAndUpdate(
            internId,
            { $pull: { batches: batchId } }
        );

        // Remove intern from batch's students
        await Batch.findByIdAndUpdate(
            batchId,
            { $pull: { students: internId } }
        );

        res.send({ message: "Intern successfully removed from batch" });
    } catch (error) {
        res.status(500).json(error);
    }
};

const getUpcomingBatches = async (req, res) => {
    try {
        const batches = await Batch.find({ 
            status: "Upcoming",
            startDate: { $gt: new Date() }
        }).sort({ startDate: 1 });

        if (batches.length > 0) {
            res.send(batches);
        } else {
            res.send({ message: "No upcoming batches found" });
        }
    } catch (error) {
        res.status(500).json(error);
    }
};

const getOngoingBatches = async (req, res) => {
    try {
        const batches = await Batch.find({ 
            status: "Ongoing"
        });

        if (batches.length > 0) {
            res.send(batches);
        } else {
            res.send({ message: "No ongoing batches found" });
        }
    } catch (error) {
        res.status(500).json(error);
    }
};

module.exports = { 
    batchCreate, 
    batchList, 
    deleteBatch, 
    deleteBatches, 
    getBatchDetail, 
    getBatchInterns,
    updateBatchStatus,
    assignInternToBatch,
    removeInternFromBatch,
    getUpcomingBatches,
    getOngoingBatches
};