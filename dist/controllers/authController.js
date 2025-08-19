"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = exports.logout = exports.googleAuth = exports.login = exports.signup = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const google_auth_library_1 = require("google-auth-library");
const connection_1 = __importDefault(require("../database/connection"));
const auth_1 = require("../middleware/auth");
const googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const signup = async (req, res) => {
    try {
        const { email, password, firstName, lastName } = req.body;
        if (!email || !password || !firstName || !lastName) {
            res.status(400).json({ error: "All fields are required" });
            return;
        }
        const existingUser = await connection_1.default.query("SELECT id FROM users WHERE email = $1", [email]);
        if (existingUser.rows.length > 0) {
            res.status(409).json({ error: "User already exists" });
            return;
        }
        const saltRounds = 12;
        const passwordHash = await bcryptjs_1.default.hash(password, saltRounds);
        const result = await connection_1.default.query("INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name, is_premium", [email, passwordHash, firstName, lastName]);
        const user = result.rows[0];
        const token = (0, auth_1.generateToken)({
            userId: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            isPremium: user.is_premium,
        });
        await connection_1.default.query("INSERT INTO folders (name, owner_id, path) VALUES ($1, $2, $3)", ["My Drive", user.id, "/"]);
        res.status(201).json({
            message: "User created successfully",
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                isPremium: user.is_premium,
            },
        });
    }
    catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.signup = signup;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: "Email and password are required" });
            return;
        }
        const result = await connection_1.default.query("SELECT id, email, password_hash, first_name, last_name, is_premium FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }
        const user = result.rows[0];
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!isValidPassword) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }
        const token = (0, auth_1.generateToken)({
            userId: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            isPremium: user.is_premium,
        });
        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                isPremium: user.is_premium,
            },
        });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.login = login;
const googleAuth = async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            res.status(400).json({ error: "ID token is required" });
            return;
        }
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload) {
            res.status(400).json({ error: "Invalid Google token" });
            return;
        }
        const { email, given_name, family_name, sub: googleId } = payload;
        if (!email || !given_name || !family_name) {
            res.status(400).json({ error: "Invalid Google token payload" });
            return;
        }
        let result = await connection_1.default.query("SELECT id, email, first_name, last_name, is_premium FROM users WHERE google_id = $1 OR email = $2", [googleId, email]);
        let user;
        if (result.rows.length > 0) {
            user = result.rows[0];
            if (!user.google_id) {
                await connection_1.default.query("UPDATE users SET google_id = $1 WHERE id = $2", [
                    googleId,
                    user.id,
                ]);
            }
        }
        else {
            result = await connection_1.default.query("INSERT INTO users (email, first_name, last_name, google_id) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name, is_premium", [email, given_name, family_name, googleId]);
            user = result.rows[0];
            await connection_1.default.query("INSERT INTO folders (name, owner_id, path) VALUES ($1, $2, $3)", ["My Drive", user.id, "/"]);
        }
        const token = (0, auth_1.generateToken)({
            userId: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            isPremium: user.is_premium,
        });
        res.json({
            message: "Google authentication successful",
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                isPremium: user.is_premium,
            },
        });
    }
    catch (error) {
        console.error("Google auth error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.googleAuth = googleAuth;
const logout = async (req, res) => {
    try {
        res.json({ message: "Logout successful" });
    }
    catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.logout = logout;
const getProfile = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        const result = await connection_1.default.query("SELECT id, email, first_name, last_name, avatar_url, storage_used, storage_limit, is_premium, created_at FROM users WHERE id = $1", [req.user.id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        const user = result.rows[0];
        res.json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                avatarUrl: user.avatar_url,
                storageUsed: user.storage_used,
                storageLimit: user.storage_limit,
                isPremium: user.is_premium,
                createdAt: user.created_at,
            },
        });
    }
    catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getProfile = getProfile;
//# sourceMappingURL=authController.js.map