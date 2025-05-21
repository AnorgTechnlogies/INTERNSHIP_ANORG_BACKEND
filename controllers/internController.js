const bcrypt = require('bcrypt');
const Intern = require('../models/internSchema.js');
const Batch = require('../models/batchSchema.js');

const internRegister = async (req, res) => {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(req.body.password, salt);

        const existingIntern = await Intern.findOne({
            email: req.body.email,
        });

        if (existingIntern) {
            res.send({ message: 'Email already exists' });
        }
        else {
            // Create batchIds array from the request if present, otherwise empty array
            const batchIds = req.body.batches || [];
            
            const intern = new Intern({
                name: req.body.name,
                email: req.body.email,
                password: hashedPass,
                batches: batchIds
            });

            let result = await intern.save();

            // If batches were specified, update each batch to include this intern
            if (batchIds.length > 0) {
                await Batch.updateMany(
                    { _id: { $in: batchIds } },
                    { $push: { students: result._id } }
                );
            }

            result.password = undefined;
            res.send(result);
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const internLogIn = async (req, res) => {
    try {
        let intern = await Intern.findOne({ email: req.body.email });
        if (intern) {
            const validated = await bcrypt.compare(req.body.password, intern.password);
            if (validated) {
                // Populate batch information
                intern = await intern.populate("batches", "batchName scheduleTitle");
                intern.password = undefined;
                res.send(intern);
            } else {
                res.send({ message: "Invalid password" });
            }
        } else {
            res.send({ message: "Intern not found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const getInterns = async (req, res) => {
    try {
        let interns = await Intern.find().populate("batches", "batchName scheduleTitle");
        if (interns.length > 0) {
            let modifiedInterns = interns.map((intern) => {
                return { ...intern._doc, password: undefined };
            });
            res.send(modifiedInterns);
        } else {
            res.send({ message: "No interns found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const getInternDetail = async (req, res) => {
    try {
        let intern = await Intern.findById(req.params.id)
            .populate("batches", "batchName scheduleTitle modeOfBatch location subject duration startDate endDate time");
        
        if (intern) {
            intern.password = undefined;
            res.send(intern);
        }
        else {
            res.send({ message: "No intern found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const deleteIntern = async (req, res) => {
    try {
        const intern = await Intern.findById(req.params.id);
        if (!intern) {
            return res.send({ message: "Intern not found" });
        }

        // Remove intern from all batches they're enrolled in
        await Batch.updateMany(
            { students: req.params.id },
            { $pull: { students: req.params.id } }
        );

        const result = await Intern.findByIdAndDelete(req.params.id);
        res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const deleteInterns = async (req, res) => {
    try {
        // Get list of all interns to be deleted
        const interns = await Intern.find();
        const internIds = interns.map(intern => intern._id);

        // Remove interns from all batches
        await Batch.updateMany(
            { students: { $in: internIds } },
            { $pull: { students: { $in: internIds } } }
        );

        const result = await Intern.deleteMany({});
        if (result.deletedCount === 0) {
            res.send({ message: "No interns found to delete" });
        } else {
            res.send(result);
        }
    } catch (error) {
        res.status(500).json(error);
    }
};

const deleteInternsByBatch = async (req, res) => {
    try {
        // Find interns in this batch
        const interns = await Intern.find({ batches: req.params.id });
        
        // For each intern, remove this batch from their batches array
        for (const intern of interns) {
            intern.batches = intern.batches.filter(
                batch => batch.toString() !== req.params.id
            );
            await intern.save();
        }

        // Update the batch to remove all students
        await Batch.findByIdAndUpdate(
            req.params.id,
            { $set: { students: [] } }
        );

        res.send({ 
            message: `Removed ${interns.length} interns from the batch`,
            count: interns.length
        });
    } catch (error) {
        res.status(500).json(error);
    }
};

const updateIntern = async (req, res) => {
    try {
        const internId = req.params.id;
        const updateData = { ...req.body };
        
        // Handle password update
        if (updateData.password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(updateData.password, salt);
        }

        // Handle batch changes if present
        if (updateData.batches) {
            const currentIntern = await Intern.findById(internId);
            if (!currentIntern) {
                return res.status(404).send({ message: "Intern not found" });
            }

            // Get current batch list
            const currentBatches = currentIntern.batches.map(b => b.toString());
            const newBatches = updateData.batches;

            // Find batches to add (in new but not in current)
            const batchesToAdd = newBatches.filter(b => !currentBatches.includes(b));
            
            // Find batches to remove (in current but not in new)
            const batchesToRemove = currentBatches.filter(b => !newBatches.includes(b));

            // Update batches that need to add this intern
            if (batchesToAdd.length > 0) {
                await Batch.updateMany(
                    { _id: { $in: batchesToAdd } },
                    { $push: { students: internId } }
                );
            }

            // Update batches that need to remove this intern
            if (batchesToRemove.length > 0) {
                await Batch.updateMany(
                    { _id: { $in: batchesToRemove } },
                    { $pull: { students: internId } }
                );
            }
        }

        // Update the intern
        let result = await Intern.findByIdAndUpdate(
            internId,
            { $set: updateData },
            { new: true }
        );

        if (!result) {
            return res.status(404).send({ message: "Intern not found" });
        }

        result.password = undefined;
        res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const internAttendance = async (req, res) => {
    const { date, status } = req.body;

    try {
        const intern = await Intern.findById(req.params.id);

        if (!intern) {
            return res.send({ message: 'Intern not found' });
        }

        const existingAttendance = intern.attendance.find(
            (a) => a.date.toDateString() === new Date(date).toDateString()
        );

        if (existingAttendance) {
            existingAttendance.status = status;
        } else {
            intern.attendance.push({ date, status });
        }

        const result = await intern.save();
        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const clearAllInternsAttendance = async (req, res) => {
    try {
        const result = await Intern.updateMany(
            {},
            { $set: { attendance: [] } }
        );

        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const removeInternAttendance = async (req, res) => {
    const internId = req.params.id;

    try {
        const result = await Intern.updateOne(
            { _id: internId },
            { $set: { attendance: [] } }
        );

        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const assignBatchToIntern = async (req, res) => {
    try {
        const { internId, batchId } = req.body;
        
        // Check if intern exists
        const intern = await Intern.findById(internId);
        if (!intern) {
            return res.status(404).send({ message: "Intern not found" });
        }

        // Check if batch exists
        const batch = await Batch.findById(batchId);
        if (!batch) {
            return res.status(404).send({ message: "Batch not found" });
        }

        // Check if intern is already assigned to this batch
        if (intern.batches.includes(batchId)) {
            return res.status(400).send({ message: "Intern is already assigned to this batch" });
        }

        // Add batch to intern's batches
        intern.batches.push(batchId);
        await intern.save();

        // Add intern to batch's students if not already there
        if (!batch.students.includes(internId)) {
            batch.students.push(internId);
            await batch.save();
        }

        res.send({ 
            message: "Batch successfully assigned to intern",
            intern: {
                _id: intern._id,
                name: intern.name,
                email: intern.email,
                batches: intern.batches
            }
        });
    } catch (error) {
        res.status(500).json(error);
    }
};

const removeBatchFromIntern = async (req, res) => {
    try {
        const { internId, batchId } = req.body;
        
        // Check if intern exists
        const intern = await Intern.findById(internId);
        if (!intern) {
            return res.status(404).send({ message: "Intern not found" });
        }

        // Check if batch exists
        const batch = await Batch.findById(batchId);
        if (!batch) {
            return res.status(404).send({ message: "Batch not found" });
        }

        // Check if intern is assigned to this batch
        if (!intern.batches.includes(batchId)) {
            return res.status(400).send({ message: "Intern is not assigned to this batch" });
        }

        // Remove batch from intern's batches
        intern.batches = intern.batches.filter(b => b.toString() !== batchId);
        await intern.save();

        // Remove intern from batch's students
        batch.students = batch.students.filter(s => s.toString() !== internId);
        await batch.save();

        res.send({ 
            message: "Batch successfully removed from intern",
            intern: {
                _id: intern._id,
                name: intern.name,
                email: intern.email,
                batches: intern.batches
            }
        });
    } catch (error) {
        res.status(500).json(error);
    }
};

const getInternsByBatch = async (req, res) => {
    try {
        const batchId = req.params.id;
        
        // Check if batch exists
        const batch = await Batch.findById(batchId);
        if (!batch) {
            return res.status(404).send({ message: "Batch not found" });
        }

        // Find interns who are in this batch
        const interns = await Intern.find({ batches: batchId })
            .select('-password');
        
        if (interns.length > 0) {
            res.send(interns);
        } else {
            res.send({ message: "No interns found in this batch" });
        }
    } catch (error) {
        res.status(500).json(error);
    }
};

module.exports = {
    internRegister,
    internLogIn,
    getInterns,
    getInternDetail,
    deleteInterns,
    deleteIntern,
    updateIntern,
    internAttendance,
    deleteInternsByBatch,
    clearAllInternsAttendance,
    removeInternAttendance,
    assignBatchToIntern,
    removeBatchFromIntern,
    getInternsByBatch
};