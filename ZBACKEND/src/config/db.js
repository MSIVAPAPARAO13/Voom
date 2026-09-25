import logger from "../utils/logger.js";
import mongoose from "mongoose";

/**
 * Connect to MongoDB database using MONGODB_URI environment variable.
 */
export const connectDB = async () => {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
        logger.error("WARNING: MONGODB_URI is not defined in environment variables.");
        return;
    }

    try {
        const connection = await mongoose.connect(mongoURI);
        logger.info("MongoDB connection configured");
        logger.info(`MongoDB host: ${connection.connection.host || "<connected>"}`);
        logger.info(`Database: ${connection.connection.name || "<default>"}`);
        return connection;
    } catch (error) {
        logger.error(`MongoDB connection error: ${error.message}`);
        throw error;
    }
};
