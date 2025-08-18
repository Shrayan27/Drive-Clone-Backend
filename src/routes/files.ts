import { Router } from "express";
import {
  uploadFile,
  getFiles,
  deleteFile,
  restoreFile,
  getTrash,
} from "../controllers/fileController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// All file routes require authentication
router.use(authenticateToken);

// File operations
router.post("/upload", uploadFile);
router.get("/", getFiles);
router.delete("/:fileId", deleteFile);
router.post("/:fileId/restore", restoreFile);

// Trash management
router.get("/trash", getTrash);

export default router;
