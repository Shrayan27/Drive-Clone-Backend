"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBreadcrumbs = exports.deleteFolder = exports.updateFolder = exports.getFolderHierarchy = exports.getFolders = exports.createFolder = void 0;
const uuid_1 = require("uuid");
const connection_1 = __importDefault(require("../database/connection"));
const createFolder = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        const { name, parentId } = req.body;
        const userId = req.user.id;
        if (!name) {
            res.status(400).json({ error: "Folder name is required" });
            return;
        }
        const existingFolder = await connection_1.default.query("SELECT id FROM folders WHERE name = $1 AND parent_id = $2 AND owner_id = $3 AND is_deleted = FALSE", [name, parentId || null, userId]);
        if (existingFolder.rows.length > 0) {
            res.status(409).json({ error: "Folder with this name already exists" });
            return;
        }
        let path = "/";
        if (parentId) {
            const parentResult = await connection_1.default.query("SELECT path FROM folders WHERE id = $1 AND owner_id = $2 AND is_deleted = FALSE", [parentId, userId]);
            if (parentResult.rows.length === 0) {
                res.status(404).json({ error: "Parent folder not found" });
                return;
            }
            path = `${parentResult.rows[0].path}${name}/`;
        }
        else {
            path = `/${name}/`;
        }
        const result = await connection_1.default.query("INSERT INTO folders (id, name, parent_id, owner_id, path) VALUES ($1, $2, $3, $4, $5) RETURNING *", [(0, uuid_1.v4)(), name, parentId || null, userId, path]);
        const folder = result.rows[0];
        res.status(201).json({
            message: "Folder created successfully",
            folder: {
                id: folder.id,
                name: folder.name,
                parentId: folder.parent_id,
                path: folder.path,
                createdAt: folder.created_at,
            },
        });
    }
    catch (error) {
        console.error("Create folder error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.createFolder = createFolder;
const getFolders = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        const { parentId, includeFiles = "false" } = req.query;
        const userId = req.user.id;
        let query = `
      SELECT f.*, 
             COUNT(sf.id) as subfolder_count,
             COUNT(sfi.id) as file_count
      FROM folders f
      LEFT JOIN folders sf ON sf.parent_id = f.id AND sf.is_deleted = FALSE
      LEFT JOIN files sfi ON sfi.folder_id = f.id AND sfi.is_deleted = FALSE
      WHERE f.owner_id = $1 AND f.is_deleted = FALSE
    `;
        const queryParams = [userId];
        if (parentId) {
            query += ` AND f.parent_id = $2`;
            queryParams.push(parentId);
        }
        else if (parentId === "root") {
            query += ` AND f.parent_id IS NULL`;
        }
        query += ` GROUP BY f.id ORDER BY f.name ASC`;
        const result = await connection_1.default.query(query, queryParams);
        const folders = result.rows.map((folder) => ({
            id: folder.id,
            name: folder.name,
            parentId: folder.parent_id,
            path: folder.path,
            subfolderCount: parseInt(folder.subfolder_count),
            fileCount: parseInt(folder.file_count),
            createdAt: folder.created_at,
            updatedAt: folder.updated_at,
        }));
        let files = [];
        if (includeFiles === "true") {
            const filesQuery = `
        SELECT id, name, original_name, mime_type, size, thumbnail_url, created_at
        FROM files 
        WHERE folder_id = $1 AND owner_id = $2 AND is_deleted = FALSE
        ORDER BY name ASC
      `;
            const filesResult = await connection_1.default.query(filesQuery, [
                parentId || null,
                userId,
            ]);
            files = filesResult.rows.map((file) => ({
                id: file.id,
                name: file.name,
                originalName: file.original_name,
                mimeType: file.mime_type,
                size: file.size,
                thumbnailUrl: file.thumbnail_url,
                createdAt: file.created_at,
            }));
        }
        res.json({
            folders,
            files,
            currentPath: parentId && typeof parentId === "string"
                ? await getCurrentPath(parentId, userId)
                : "/",
        });
    }
    catch (error) {
        console.error("Get folders error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getFolders = getFolders;
const getFolderHierarchy = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        const userId = req.user.id;
        const result = await connection_1.default.query("SELECT id, name, parent_id, path FROM folders WHERE owner_id = $1 AND is_deleted = FALSE ORDER BY path", [userId]);
        const folders = result.rows;
        const folderMap = new Map();
        const rootFolders = [];
        folders.forEach((folder) => {
            folderMap.set(folder.id, {
                id: folder.id,
                name: folder.name,
                parentId: folder.parent_id,
                path: folder.path,
                children: [],
            });
        });
        folders.forEach((folder) => {
            if (folder.parent_id) {
                const parent = folderMap.get(folder.parent_id);
                if (parent) {
                    parent.children.push(folderMap.get(folder.id));
                }
            }
            else {
                rootFolders.push(folderMap.get(folder.id));
            }
        });
        res.json({ hierarchy: rootFolders });
    }
    catch (error) {
        console.error("Get folder hierarchy error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getFolderHierarchy = getFolderHierarchy;
const updateFolder = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        const { folderId } = req.params;
        const { name } = req.body;
        const userId = req.user.id;
        if (!name) {
            res.status(400).json({ error: "Folder name is required" });
            return;
        }
        const folderResult = await connection_1.default.query("SELECT id, parent_id, path FROM folders WHERE id = $1 AND owner_id = $2 AND is_deleted = FALSE", [folderId, userId]);
        if (folderResult.rows.length === 0) {
            res.status(404).json({ error: "Folder not found" });
            return;
        }
        const folder = folderResult.rows[0];
        const existingFolder = await connection_1.default.query("SELECT id FROM folders WHERE name = $1 AND parent_id = $2 AND owner_id = $3 AND id != $4 AND is_deleted = FALSE", [name, folder.parent_id, userId, folderId]);
        if (existingFolder.rows.length > 0) {
            res.status(409).json({ error: "Folder with this name already exists" });
            return;
        }
        await connection_1.default.query("UPDATE folders SET name = $1 WHERE id = $2", [
            name,
            folderId,
        ]);
        const oldPath = folder.path;
        const newPath = oldPath.replace(/\/[^\/]+\/$/, `/${name}/`);
        await connection_1.default.query("UPDATE folders SET path = REPLACE(path, $1, $2) WHERE path LIKE $3 AND owner_id = $4", [oldPath, newPath, `${oldPath}%`, userId]);
        res.json({ message: "Folder updated successfully" });
    }
    catch (error) {
        console.error("Update folder error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.updateFolder = updateFolder;
const deleteFolder = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        const { folderId } = req.params;
        const userId = req.user.id;
        const folderResult = await connection_1.default.query("SELECT id, path FROM folders WHERE id = $1 AND owner_id = $2 AND is_deleted = FALSE", [folderId, userId]);
        if (folderResult.rows.length === 0) {
            res.status(404).json({ error: "Folder not found" });
            return;
        }
        const folder = folderResult.rows[0];
        await connection_1.default.query("UPDATE folders SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP WHERE path LIKE $1 AND owner_id = $2", [`${folder.path}%`, userId]);
        await connection_1.default.query(`UPDATE files SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP 
       WHERE id IN (
         SELECT f.id FROM files f
         JOIN folders fo ON f.folder_id = fo.id
         WHERE fo.path LIKE $1 AND f.owner_id = $2
       )`, [`${folder.path}%`, userId]);
        res.json({ message: "Folder deleted successfully" });
    }
    catch (error) {
        console.error("Delete folder error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.deleteFolder = deleteFolder;
const getBreadcrumbs = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        const { folderId } = req.params;
        const userId = req.user.id;
        if (!folderId || folderId === "root") {
            res.json({ breadcrumbs: [{ id: "root", name: "My Drive", path: "/" }] });
            return;
        }
        const folderResult = await connection_1.default.query("SELECT path FROM folders WHERE id = $1 AND owner_id = $2 AND is_deleted = FALSE", [folderId, userId]);
        if (folderResult.rows.length === 0) {
            res.status(404).json({ error: "Folder not found" });
            return;
        }
        const path = folderResult.rows[0].path;
        const pathParts = path.split("/").filter(Boolean);
        const breadcrumbs = [{ id: "root", name: "My Drive", path: "/" }];
        let currentPath = "";
        for (let i = 0; i < pathParts.length - 1; i++) {
            currentPath += `/${pathParts[i]}`;
            const partResult = await connection_1.default.query("SELECT id, name FROM folders WHERE path = $1 AND owner_id = $2 AND is_deleted = FALSE", [currentPath + "/", userId]);
            if (partResult.rows.length > 0) {
                breadcrumbs.push({
                    id: partResult.rows[0].id,
                    name: partResult.rows[0].name,
                    path: currentPath + "/",
                });
            }
        }
        res.json({ breadcrumbs });
    }
    catch (error) {
        console.error("Get breadcrumbs error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getBreadcrumbs = getBreadcrumbs;
async function getCurrentPath(folderId, userId) {
    const result = await connection_1.default.query("SELECT path FROM folders WHERE id = $1 AND owner_id = $2 AND is_deleted = FALSE", [folderId, userId]);
    if (result.rows.length === 0) {
        return "/";
    }
    return result.rows[0].path;
}
//# sourceMappingURL=folderController.js.map