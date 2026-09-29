import logger from "./utils/logger.js";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.ENV") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import app from "./app.js";
import { connectDB } from "./config/db.js";
import { connectToSocket } from "./sockets/socketManager.js";

const server = createServer(app);
const io = connectToSocket(server);

const PORT = app.get("port");

const startServer = async () => {
    server.listen(PORT, () => {
        logger.info(`SERVER RUNNING ON PORT ${PORT}`);
    });

    try {
        await connectDB();
    } catch (error) {
        logger.error("Database connection failed. Please ensure a valid MONGODB_URI is configured in .env");
    }
};

startServer();

export { server, io };
