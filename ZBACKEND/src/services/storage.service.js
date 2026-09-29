import fs from "fs";
import path from "path";

/**
 * Storage Service Abstraction for Meeting Recordings.
 *
 * Implements local filesystem storage for development, designed to be extensible
 * for future cloud object storage (e.g. S3, Cloudflare R2) without modifying
 * meeting controller business logic.
 */
class StorageService {
    constructor(baseDir) {
        this.baseDir = baseDir || process.env.RECORDING_STORAGE_DIR || path.resolve(process.cwd(), "storage", "recordings");
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }

    /**
     * Resolves and verifies that a filename is safe against path traversal attacks.
     * Rejects any path separators, parent directory markers (..), or paths escaping baseDir.
     */
    _resolveSafePath(filename) {
        if (!filename || typeof filename !== "string") {
            const err = new Error("Invalid filename provided");
            err.code = "EINVAL";
            throw err;
        }

        const basename = path.basename(filename);
        if (basename !== filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
            const err = new Error("Potential path traversal detected in storage key");
            err.code = "EACCES";
            throw err;
        }

        const resolvedPath = path.resolve(this.baseDir, basename);
        if (!resolvedPath.startsWith(this.baseDir)) {
            const err = new Error("Path traversal outside storage directory rejected");
            err.code = "EACCES";
            throw err;
        }

        return resolvedPath;
    }

    /**
     * Get the safe absolute file path for a storage key.
     */
    getFilePath(filename) {
        return this._resolveSafePath(filename);
    }

    /**
     * Persist a readable stream to disk without buffering in memory.
     * Enforces maximum file size to prevent disk exhaustion.
     */
    async saveStream(filename, readableStream, maxSizeBytes = 500 * 1024 * 1024) {
        const filePath = this._resolveSafePath(filename);
        const writeStream = fs.createWriteStream(filePath);
        let bytesWritten = 0;

        return new Promise((resolve, reject) => {
            readableStream.on("data", (chunk) => {
                bytesWritten += chunk.length;
                if (maxSizeBytes && bytesWritten > maxSizeBytes) {
                    readableStream.destroy();
                    writeStream.destroy();
                    fs.unlink(filePath, () => {});
                    const err = new Error(`Recording exceeds maximum allowed size of ${maxSizeBytes} bytes`);
                    err.code = "ELIMIT";
                    return reject(err);
                }
            });

            readableStream.pipe(writeStream);

            writeStream.on("finish", () => {
                resolve({ filename, bytesWritten, filePath });
            });

            writeStream.on("error", (err) => {
                fs.unlink(filePath, () => {});
                reject(err);
            });

            readableStream.on("error", (err) => {
                writeStream.destroy();
                fs.unlink(filePath, () => {});
                reject(err);
            });
        });
    }

    /**
     * Save buffer directly to disk.
     */
    async saveBuffer(filename, buffer) {
        const filePath = this._resolveSafePath(filename);
        await fs.promises.writeFile(filePath, buffer);
        return { filename, bytesWritten: buffer.length, filePath };
    }

    /**
     * Get file stats (size, creation time, etc.). Returns null if file not found.
     */
    async getFileStats(filename) {
        const filePath = this._resolveSafePath(filename);
        try {
            const stats = await fs.promises.stat(filePath);
            return stats;
        } catch (err) {
            if (err.code === "ENOENT") {
                return null;
            }
            throw err;
        }
    }

    /**
     * Get a readable stream for a file, supporting optional byte-range reads.
     * @param {string} filename 
     * @param {{ start?: number, end?: number }} [range] 
     * @returns {fs.ReadStream}
     */
    getStream(filename, range = null) {
        const filePath = this._resolveSafePath(filename);
        if (!fs.existsSync(filePath)) {
            const error = new Error("File not found");
            error.code = "ENOENT";
            throw error;
        }
        const options = {};
        if (range) {
            if (typeof range.start === "number") options.start = range.start;
            if (typeof range.end === "number") options.end = range.end;
        }
        return fs.createReadStream(filePath, options);
    }

    /**
     * Delete file from storage. Returns true if deleted, false if file did not exist.
     */
    async delete(filename) {
        const filePath = this._resolveSafePath(filename);
        try {
            await fs.promises.unlink(filePath);
            return true;
        } catch (err) {
            if (err.code === "ENOENT") {
                return false;
            }
            throw err;
        }
    }
}

export const storageService = new StorageService();
export default storageService;
