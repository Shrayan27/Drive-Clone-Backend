"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fileController_1 = require("../controllers/fileController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.post("/upload", fileController_1.uploadFile);
router.get("/", fileController_1.getFiles);
router.delete("/:fileId", fileController_1.deleteFile);
router.post("/:fileId/restore", fileController_1.restoreFile);
router.get("/trash", fileController_1.getTrash);
exports.default = router;
//# sourceMappingURL=files.js.map