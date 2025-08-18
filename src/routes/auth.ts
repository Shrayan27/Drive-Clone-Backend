import { Router } from "express";
import {
  signup,
  login,
  googleAuth,
  logout,
  getProfile,
} from "../controllers/authController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Public routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleAuth);

// Protected routes
router.post("/logout", authenticateToken, logout);
router.get("/profile", authenticateToken, getProfile);

export default router;
