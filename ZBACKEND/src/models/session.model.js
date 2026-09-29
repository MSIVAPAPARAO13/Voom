import mongoose, { Schema } from "mongoose";

const sessionSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    family: { type: String, required: true, index: true }, // Token family UUID
    tokenHash: { type: String, required: true, index: true }, // SHA-256 hash of active refresh token
    rotatedHashes: [{ type: String }], // Previous hashes in this family to detect reuse
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // MongoDB TTL index for automatic expiration
    isRevoked: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Session = mongoose.model("Session", sessionSchema);

export { Session };
