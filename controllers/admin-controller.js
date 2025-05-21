
const Admin = require('../models/adminSchema.js');
const Batch = require('../models/batchSchema.js');
const Intern = require('../models/internSchema.js');
const Teacher = require('../models/teacherSchema.js');
const Notice = require('../models/noticeSchema.js');
const Complain = require('../models/complainSchema.js');
const XLSX = require('xlsx');
const bcrypt = require('bcrypt');

const adminRegister = async (req, res) => {

    console.log(req.body);
    
    try {
        // Check if admin with this email already exists
        const existingAdminByEmail = await Admin.findOne({ email: req.body.email });
        
        if (existingAdminByEmail) {
            return res.status(400).send({ message: 'Email already exists' });
        }
        
        // Hash the password before saving
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(req.body.password, salt);
        
        // Create new admin with hashed password
        const admin = new Admin({
            ...req.body,
            password: hashedPassword
        });
        
        // Save admin to database
        const result = await admin.save();
        
        // Remove password from response
        result.password = undefined;
        
        // Send successful response
        res.status(201).send(result);
    } catch (err) {
        console.error('Admin registration error:', err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
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
        }
        else {
            res.send({ message: "No admin found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
}

const bulkInternRegister = async (req, res) => {
    try {
        const { batchId } = req.body;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        if (!batchId) {
            return res.status(400).json({ message: 'Batch ID is required' });
        }

        // Parse Excel file
        let workbook;
        try {
            workbook = XLSX.read(file.buffer, { type: 'buffer' });
        } catch (err) {
            return res.status(400).json({ message: 'Invalid Excel file format' });
        }
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return res.status(400).json({ message: 'Excel file contains no sheets' });
        }
        
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);
        
        if (!data || data.length === 0) {
            return res.status(400).json({ message: 'Excel file contains no data' });
        }

        // Validate batch
        try {
            const batch = await Batch.findById(batchId);
            
            if (!batch) {
                return res.status(404).json({ message: 'Batch not found' });
            }
        } catch (err) {
            return res.status(400).json({ message: 'Invalid Batch ID' });
        }

        const registeredInterns = [];
        const errors = [];

        // Process each intern
        for (const row of data) {
            const { name, email, password } = row;
            
            if (!name || !email || !password) {
                errors.push(`Missing data for intern: ${name || email || 'Unknown'}`);
                continue;
            }
            
            try {
                // Check for existing intern
                const existingIntern = await Intern.findOne({ email });
                
                if (existingIntern) {
                    // If intern exists, just add the batch to their batches array if not already there
                    if (!existingIntern.batches.includes(batchId)) {
                        existingIntern.batches.push(batchId);
                        await existingIntern.save();
                        registeredInterns.push({ name: existingIntern.name, email: existingIntern.email, status: 'Added to batch' });
                    } else {
                        errors.push(`Intern with email ${email} is already assigned to this batch`);
                    }
                    continue;
                }
                
                // Hash password
                const hashedPassword = await bcrypt.hash(password.toString(), 10);
                
                // Create new intern
                const intern = new Intern({
                    name,
                    email,
                    password: hashedPassword,
                    batches: [batchId],
                    role: 'Intern'
                });
                
                await intern.save();
                
                // Update batch with new intern
                await Batch.findByIdAndUpdate(batchId, {
                    $push: { students: intern._id }
                });
                
                registeredInterns.push({ name, email, status: 'Newly registered' });
            } catch (err) {
                errors.push(`Error registering intern ${name}: ${err.message}`);
            }
        }
        
        res.status(200).json({
            message: 'Bulk intern registration processed',
            registered: registeredInterns,
            errors
        });
    } catch (err) {
        console.error('Bulk upload error:', err);
        res.status(500).json({ 
            message: 'Server error processing bulk upload',
            error: err.message 
        });
    }
};

module.exports = { adminRegister, adminLogIn, getAdminDetail, bulkInternRegister };