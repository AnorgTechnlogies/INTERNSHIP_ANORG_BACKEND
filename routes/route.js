const router = require('express').Router();
const upload = require('../middlewares/multer.js');
const { adminRegister, adminLogIn, getAdminDetail, bulkInternRegister } = require('../controllers/admin-controller.js');
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
} = require('../controllers/interncontroller.js');
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
    addNotes
} = require('../controllers/teacher-controller.js');


// Admin
router.post('/AdminReg', adminRegister);
router.post('/AdminLogin', adminLogIn);
router.get("/Admin/:id", getAdminDetail);

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