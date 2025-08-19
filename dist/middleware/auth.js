"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.verifyToken = exports.generateToken = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const connection_1 = __importDefault(require("../database/connection"));
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];
        const token = authHeader && authHeader.split(" ")[1];
        if (!token) {
            res.status(401).json({ error: "Access token required" });
            return;
        }
        const mockUser = {
            id: "mock-user-id",
            email: "mock@example.com",
            firstName: "Mock",
            lastName: "User",
            isPremium: false,
        };
        req.user = mockUser;
        next();
    }
    catch (error) {
        console.error("Auth middleware error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.authenticateToken = authenticateToken;
const generateToken = (payload) => {
    return "mock-jwt-token";
};
exports.generateToken = generateToken;
const verifyToken = (token) => {
    return {
        userId: "mock-user-id",
        email: "mock@example.com",
        firstName: "Mock",
        lastName: "User",
        isPremium: false,
    };
};
exports.verifyToken = verifyToken;
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];
        const token = authHeader && authHeader.split(" ")[1];
        if (token) {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "fallback-secret");
            const userResult = await connection_1.default.query("SELECT id, email, first_name, last_name, is_premium FROM users WHERE id = $1", [decoded.userId]);
            if (userResult.rows.length > 0) {
                const user = userResult.rows[0];
                req.user = {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    isPremium: user.is_premium,
                };
            }
        }
        next();
    }
    catch (error) {
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map