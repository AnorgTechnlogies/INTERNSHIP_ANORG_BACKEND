const router = require('express').Router();
const upload = require('../middlewares/multer.js');
const { adminRegister, adminLogIn, getAdminDetail, bulkInternRegister, getAllAttendance } = require('../controllers/admin-controller.js');
const { batchCreate, batchList, deleteBatch, deleteBatches, getBatchDetail, getBatchInterns, updateBatchStatus, assignInternToBatch, removeInternFromBatch, getUpcomingBatches, getOngoingBatches } = require('../controllers/batchController.js');
const { complainCreate, complainList } = require('../controllers/complain-controller.js');
const { noticeCreate, noticeList, deleteNotices, deleteNotice, updateNotice } = require('../controllers/notice-controller.js');
const {
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
} = require('../controllers/internController.js');
const {
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
    deleteNotes
} = require('../controllers/teacher-controller.js');
const { employeeRegister, employeeLogIn, getEmployeeDetail, getAllEmployeeAttendance, bulkEmployeeRegister, getAllEmployeesByAdmin, employeeAttendanceByAdmin } = require('../controllers/employee-controller.js');


// Admin
router.post('/AdminReg', adminRegister);
router.post('/AdminLogin', adminLogIn);
router.get("/Admin/:id", getAdminDetail);


// Employee
router.post('/EmployeeReg', employeeRegister);
router.post('/EmployeeLogin', employeeLogIn);
router.get("/Employee/:id", getEmployeeDetail);
router.get("/Employee/admin/:adminID", getAllEmployeesByAdmin); // New route
router.post('/bulkEmployeeReg', upload.single('file'), bulkEmployeeRegister);
router.get('/EmployeeAttendance', getAllEmployeeAttendance);
router.post('/EmployeeAttendanceByAdmin', employeeAttendanceByAdmin); // New route

// Intern
router.post('/InternReg', internRegister);
router.post('/bulkInternReg', upload.single('file'), bulkInternRegister);
router.post('/InternLogin', internLogIn);

router.get("/Interns/:id", getInterns);
router.get("/Intern/:id", getInternDetail);

router.delete("/Interns/:id", deleteInterns);
router.delete("/InternsBatch/:id", deleteInternsByBatch);
router.delete("/Intern/:id", deleteIntern);

router.put("/Intern/:id", updateIntern);

router.put('/InternAttendance/:id', internAttendance);

router.put('/RemoveAllInternsAtten/:id', clearAllInternsAttendance);
router.put('/RemoveInternAtten/:id', removeInternAttendance);

router.post('/AssignBatchToIntern', assignBatchToIntern);
router.post('/RemoveBatchFromIntern', removeBatchFromIntern);
router.get('/InternsByBatch/:id', getInternsByBatch);


router.get('/Attendance', getAllAttendance);

// Teacher
router.post('/TeacherReg', teacherRegister);
router.post('/TeacherLogin', teacherLogIn);

router.get("/Teachers/:id", getTeachers);
router.get("/Teacher/:id", getTeacherDetail);

router.delete("/Teachers/:id", deleteTeachersByBatch); // Renamed to match controller
router.delete("/Teacher/:id", deleteTeacher);

router.post('/AssignBatchToTeacher', assignBatchToTeacher);
router.post('/RemoveBatchFromTeacher', removeBatchFromTeacher);

router.post('/BulkInternAttendance', bulkInternAttendance);
router.get('/Batch/Attendance/:batchId', getBatchAttendance);
// Route to handle file uploads with addNotes
router.post("/addNotes", upload.single("file"), addNotes);

// Notes
router.get("/notes", getNotes);
router.put("/notes/:noteId", upload.single("file"), updateNotes);
router.delete("/notes/:noteId", deleteNotes);

// Notice
router.post('/NoticeCreate', noticeCreate);
router.get('/NoticeList/:id', noticeList);
router.delete("/Notices/:id", deleteNotices);
router.delete("/Notice/:id", deleteNotice);
router.put("/Notice/:id", updateNotice);

// Complain
router.post('/ComplainCreate', complainCreate);
router.get('/ComplainList/:id', complainList);

// Batch
router.post('/BatchCreate', batchCreate);
router.get('/BatchList/:id', batchList);
router.get("/Batch/:id", getBatchDetail);
router.get("/Batch/Interns/:id", getBatchInterns);
router.delete("/Batches/:id", deleteBatches);
router.delete("/Batch/:id", deleteBatch);
router.put("/BatchStatus/:id", updateBatchStatus);
router.post('/AssignInternToBatch', assignInternToBatch);
router.post('/RemoveInternFromBatch', removeInternFromBatch);
router.get('/UpcomingBatches', getUpcomingBatches);
router.get('/OngoingBatches', getOngoingBatches);

module.exports = router;