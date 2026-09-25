import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
    {
        name: { type: String, required: true },
        username: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        role: { type: String, enum: ["user", "admin"], default: "user" },
        token: { type: String } // Kept for legacy compatibility
    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export { User };