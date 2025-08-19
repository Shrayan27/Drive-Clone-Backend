"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const folderController_1 = require("../controllers/folderController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.post("/", folderController_1.createFolder);
router.get("/", folderController_1.getFolders);
router.get("/hierarchy", folderController_1.getFolderHierarchy);
router.get("/:folderId/breadcrumbs", folderController_1.getBreadcrumbs);
router.put("/:folderId", folderController_1.updateFolder);
router.delete("/:folderId", folderController_1.deleteFolder);
exports.default = router;
//# sourceMappingURL=folders.js.map