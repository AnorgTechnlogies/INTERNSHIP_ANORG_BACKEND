const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// ✅ Load env config first
dotenv.config(); 

const app = express();
const Routes = require("./routes/route.js");
const connectDB = require("./connectDB.js");

// ✅ Now use the environment variable
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '10mb' }));
app.use(cors({
    origin: process.env.FRONTEND_URI,
    credentials: true
}));

connectDB();

app.use('/', Routes);

app.get('/testing', (req, res) => {
    res.send("This is Working Properly")
})

app.listen(PORT, () => {
    console.log(`Server started at port no. ${PORT}`);
});
