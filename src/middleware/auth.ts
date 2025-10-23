import { Request, Response, NextFunction } from "express";
import { auth } from "firebase-admin";
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

    try {
      // Verify Firebase ID token
      const decodedToken = await auth().verifyIdToken(token);

      // Get user from database using Firebase UID
      const userResult = await pool.query(
        "SELECT id, email, first_name, last_name, is_premium FROM users WHERE firebase_uid = $1",
        [decodedToken.uid]
      );

      if (userResult.rows.length === 0) {
        // User doesn't exist in database, create them
        const newUserResult = await pool.query(
          `INSERT INTO users (firebase_uid, email, first_name, last_name, is_premium, storage_limit, storage_used) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           RETURNING id, email, first_name, last_name, is_premium`,
          [
            decodedToken.uid,
            decodedToken.email || "unknown@example.com",
            decodedToken.name?.split(" ")[0] || "Unknown",
            decodedToken.name?.split(" ").slice(1).join(" ") || "User",
            false, // Default to non-premium
            1073741824, // 1GB default storage limit
            0, // Start with 0 storage used
          ]
        );

        const newUser = newUserResult.rows[0];
        req.user = {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.first_name,
          lastName: newUser.last_name,
          isPremium: newUser.is_premium,
        };
      } else {
        // User exists, use their data
        const user = userResult.rows[0];
        req.user = {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          isPremium: user.is_premium,
        };
      }

      next();
    } catch (firebaseError) {
      console.error("Firebase token verification failed:", firebaseError);
      res.status(401).json({ error: "Invalid token" });
      return;
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
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
      try {
        // Verify Firebase ID token
        const decodedToken = await auth().verifyIdToken(token);

        // Get user from database using Firebase UID
        const userResult = await pool.query(
          "SELECT id, email, first_name, last_name, is_premium FROM users WHERE firebase_uid = $1",
          [decodedToken.uid]
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
      } catch (firebaseError) {
        // Token verification failed, but continue without authentication
        console.warn(
          "Firebase token verification failed in optional auth:",
          firebaseError
        );
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Generate JWT token for custom authentication
export const generateToken = (payload: JWTPayload): string => {
  const secret = process.env.JWT_SECRET || "fallback-secret-key";
  return jwt.sign(payload, secret, { expiresIn: "24h" });
};

// Verify JWT token
export const verifyToken = async (token: string): Promise<JWTPayload> => {
  const secret = process.env.JWT_SECRET || "fallback-secret-key";
  return jwt.verify(token, secret) as JWTPayload;
};