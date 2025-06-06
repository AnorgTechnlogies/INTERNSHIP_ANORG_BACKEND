const mongoose = require("mongoose");

const connectDB = async () => {
    const {
        MONGO_USER,
        MONGO_PASSWORD,
        MONGO_HOST,
        MONGO_DB,
    } = process.env;

    const uri = `mongodb://${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASSWORD)}@${MONGO_HOST}:27017/${MONGO_DB}?authSource=admin`;

    try {
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        mongoose.connection.on('connected', () => console.log("Database Connected"));
    } catch (error) {
        console.error("MongoDB connection error:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
