const mongoose = require("mongoose");

const connectDB = async () => {
    const uri = "mongodb://127.0.0.1:27017/IMS";

    try {
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        mongoose.connection.on('connected', () => console.log("Database Connected to Localhost"));
    } catch (error) {
        console.error("MongoDB connection error:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;