import { Router } from "express";
import {
  createFolder,
  getFolders,
  getFolderHierarchy,
  updateFolder,
  deleteFolder,
  getBreadcrumbs,
} from "../controllers/folderController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// All folder routes require authentication
router.use(authenticateToken);

// Folder operations
router.post("/", createFolder);
router.get("/", getFolders);
router.get("/hierarchy", getFolderHierarchy);
router.get("/:folderId/breadcrumbs", getBreadcrumbs);
router.put("/:folderId", updateFolder);
router.delete("/:folderId", deleteFolder);

export default router;
