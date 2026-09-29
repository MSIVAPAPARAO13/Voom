import httpStatus from "http-status";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";
import { Session } from "../models/session.model.js";

const getCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

const generateAccessToken = (user) => {
    return jwt.sign(
        {
            userId: user._id.toString(),
            username: user.username,
            role: user.role || "user"
        },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m" }
    );
};

const generateRefreshToken = (userId, family) => {
    return jwt.sign(
        {
            userId: userId.toString(),
            family: family
        },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d" }
    );
};

const hashToken = (token) => {
    return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Register a new user account.
 * Uses 409 Conflict for duplicate username and generic failure on validation.
 */
const register = async (req, res) => {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Please provide all required fields" });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(httpStatus.CONFLICT).json({ message: "Username already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            name,
            username,
            password: hashedPassword,
            role: "user"
        });

        await newUser.save();
        return res.status(httpStatus.CREATED).json({ message: "User Registered" });
    } catch (e) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Registration failed" });
    }
};

/**
 * Login user and issue short-lived Access Token + HttpOnly Refresh Token.
 * Generic 401 error response avoids revealing whether a username exists.
 */
const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Please provide valid username and password" });
    }

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid username or password" });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid username or password" });
        }

        // Initialize a new token family for this login session
        const family = crypto.randomUUID();
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user._id, family);
        const tokenHash = hashToken(refreshToken);

        // Store hashed refresh token in MongoDB Session collection
        await Session.create({
            user: user._id,
            family,
            tokenHash,
            rotatedHashes: [],
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        // Set HttpOnly refresh token cookie
        res.cookie("refreshToken", refreshToken, getCookieOptions());

        return res.status(httpStatus.OK).json({
            accessToken,
            token: accessToken, // Backward compatibility
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                role: user.role || "user"
            }
        });
    } catch (e) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Login failed" });
    }
};

/**
 * Refresh access token using HttpOnly cookie with rotation and reuse detection.
 */
const refreshToken = async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken;

    if (!incomingRefreshToken) {
        return res.status(httpStatus.UNAUTHORIZED).json({ message: "Refresh token required in cookie" });
    }

    let payload;
    try {
        payload = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (e) {
        res.clearCookie("refreshToken", getCookieOptions());
        return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid or expired refresh token" });
    }

    const incomingHash = hashToken(incomingRefreshToken);

    try {
        const session = await Session.findOne({ family: payload.family });

        if (!session || session.isRevoked) {
            res.clearCookie("refreshToken", getCookieOptions());
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Session revoked or expired" });
        }

        // REUSE DETECTION: If an already-rotated hash is presented, revoke the entire family!
        if (session.rotatedHashes.includes(incomingHash)) {
            session.isRevoked = true;
            await session.save();
            res.clearCookie("refreshToken", getCookieOptions());
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Security alert: Refresh token reuse detected. Session has been revoked."
            });
        }

        // Verify that the incoming token matches the current active hash
        if (session.tokenHash !== incomingHash) {
            res.clearCookie("refreshToken", getCookieOptions());
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid refresh token" });
        }

        const user = await User.findById(payload.userId);
        if (!user) {
            res.clearCookie("refreshToken", getCookieOptions());
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "User not found" });
        }

        // Rotate refresh token
        session.rotatedHashes.push(incomingHash);
        const newRefreshToken = generateRefreshToken(user._id, session.family);
        session.tokenHash = hashToken(newRefreshToken);
        session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await session.save();

        // Issue new short-lived access token and update cookie
        const newAccessToken = generateAccessToken(user);
        res.cookie("refreshToken", newRefreshToken, getCookieOptions());

        return res.status(httpStatus.OK).json({
            accessToken: newAccessToken,
            token: newAccessToken, // Backward compatibility
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                role: user.role || "user"
            }
        });
    } catch (e) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Refresh failed" });
    }
};

/**
 * Logout user: revokes session server-side and clears HttpOnly cookie.
 * Operates even if access token is expired.
 */
const logout = async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken;

    try {
        if (incomingRefreshToken) {
            const payload = jwt.decode(incomingRefreshToken);
            if (payload?.family) {
                await Session.updateOne({ family: payload.family }, { $set: { isRevoked: true } });
            }
        }
    } catch (e) {
        // Silently proceed with cookie clearing
    }

    res.clearCookie("refreshToken", getCookieOptions());
    return res.status(httpStatus.OK).json({ message: "Logged out successfully" });
};

/**
 * Get current authenticated user profile.
 */
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
        }
        return res.status(httpStatus.OK).json({
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                role: user.role || "user"
            }
        });
    } catch (e) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Failed to fetch profile" });
    }
};

/**
 * Get meeting history for authenticated user scoped strictly to active organization.
 */
const getUserHistory = async (req, res) => {
    try {
        // Strict tenant isolation: query meetings belonging to active organization and authenticated user
        const query = {
            user_id: req.user.username
        };
        if (req.organization) {
            query.organization = req.organization._id;
        }

        const meetings = await Meeting.find(query).sort({ date: -1 });
        return res.status(httpStatus.OK).json(meetings);
    } catch (e) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Failed to fetch history" });
    }
};

/**
 * Add meeting to user history scoped strictly to active organization.
 */
const addToHistory = async (req, res) => {
    const { meeting_code } = req.body;

    if (!meeting_code) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Meeting code is required" });
    }

    try {
        const newMeeting = new Meeting({
            organization: req.organization ? req.organization._id : undefined,
            createdBy: req.user.id,
            user_id: req.user.username,
            meetingCode: meeting_code
        });

        await newMeeting.save();
        return res.status(httpStatus.CREATED).json({ message: "Added code to history" });
    } catch (e) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Failed to record meeting" });
    }
};

export { register, login, refreshToken, logout, getMe, getUserHistory, addToHistory };
