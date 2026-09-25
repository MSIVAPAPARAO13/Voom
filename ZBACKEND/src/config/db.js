import mongoose from "mongoose";

/**
 * Connect to MongoDB database using MONGODB_URI environment variable.
 */
export const connectDB = async () => {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
        console.error("WARNING: MONGODB_URI is not defined in environment variables.");
        return;
    }

    try {
        const connection = await mongoose.connect(mongoURI);
        console.log("MongoDB connection configured");
        console.log(`MongoDB host: ${connection.connection.host || "<connected>"}`);
        console.log(`Database: ${connection.connection.name || "<default>"}`);
        return connection;
    } catch (error) {
        console.error(`MongoDB connection error: ${error.message}`);
        throw error;
    }
};
