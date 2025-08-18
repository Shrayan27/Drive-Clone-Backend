import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pool from "../database/connection";

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        isPremium: boolean;
      };
    }
  }
}

export interface JWTPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  isPremium: boolean;
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: "Access token required" });
      return;
    }

    // For now, create a mock user for development
    // In production, you would verify the Firebase ID token
    const mockUser = {
      id: "mock-user-id",
      email: "mock@example.com",
      firstName: "Mock",
      lastName: "User",
      isPremium: false,
    };

    req.user = mockUser;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Mock token functions for development
export const generateToken = (payload: JWTPayload): string => {
  return "mock-jwt-token";
};

export const verifyToken = (token: string): JWTPayload => {
  return {
    userId: "mock-user-id",
    email: "mock@example.com",
    firstName: "Mock",
    lastName: "User",
    isPremium: false,
  };
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "fallback-secret"
      ) as JWTPayload;

      const userResult = await pool.query(
        "SELECT id, email, first_name, last_name, is_premium FROM users WHERE id = $1",
        [decoded.userId]
      );

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
  } catch (error) {
    // Continue without authentication
    next();
  }
};
