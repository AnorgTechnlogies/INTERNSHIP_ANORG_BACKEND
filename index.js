const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// ✅ Load env config first
dotenv.config(); 

const app = express();
const Routes = require("./routes/route.js");

// ✅ Now use the environment variable
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '10mb' }));
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

mongoose
    .connect(process.env.MONGO_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => console.log("Connected to MongoDB")) // ✅ Fix this .then
    .catch((err) => console.log("NOT CONNECTED TO NETWORK", err));

app.use('/', Routes);

app.listen(PORT, () => {
    console.log(`Server started at port no. ${PORT}`);
});
