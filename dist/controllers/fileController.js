"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrash = exports.restoreFile = exports.deleteFile = exports.getFiles = exports.uploadFile = void 0;
const multer_1 = __importDefault(require("multer"));
const uuid_1 = require("uuid");
const mime_types_1 = __importDefault(require("mime-types"));
const connection_1 = __importDefault(require("../database/connection"));
const firebase_1 = require("../config/firebase");
const sharp_1 = __importDefault(require("sharp"));
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || "104857600"),
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(",") || [
            "image/*",
            "application/pdf",
            "text/*",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];
        const isAllowed = allowedTypes.some((type) => {
            if (type.endsWith("/*")) {
                return file.mimetype.startsWith(type.replace("/*", ""));
            }
            return file.mimetype === type;
        });
        if (isAllowed) {
            cb(null, true);
        }
        else {
            cb(new Error("File type not allowed"));
        }
    },
});
const uploadFile = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        upload.single("file")(req, res, async (err) => {
            if (err) {
                if (err instanceof multer_1.default.MulterError) {
                    if (err.code === "LIMIT_FILE_SIZE") {
                        res.status(400).json({ error: "File too large" });
                        return;
                    }
                }
                res.status(400).json({ error: err.message });
                return;
            }
            if (!req.file) {
                res.status(400).json({ error: "No file uploaded" });
                return;
            }
            const { folderId, name } = req.body;
            const file = req.file;
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const userResult = await connection_1.default.query("SELECT storage_used, storage_limit FROM users WHERE id = $1", [userId]);
            if (userResult.rows.length === 0) {
                res.status(404).json({ error: "User not found" });
                return;
            }
            const { storage_used, storage_limit } = userResult.rows[0];
            if (storage_used + file.size > storage_limit) {
                res.status(413).json({ error: "Storage limit exceeded" });
                return;
            }
            const fileId = (0, uuid_1.v4)();
            const fileExtension = mime_types_1.default.extension(file.mimetype) || "bin";
            const fileName = name || `${fileId}.${fileExtension}`;
            const firebasePath = `users/${userId}/files/${fileId}.${fileExtension}`;
            const fileBuffer = file.buffer;
            const fileUpload = firebase_1.bucket.file(firebasePath);
            await fileUpload.save(fileBuffer, {
                metadata: {
                    contentType: file.mimetype,
                    metadata: {
                        originalName: file.originalname,
                        uploadedBy: userId,
                    },
                },
            });
            const [url] = await fileUpload.getSignedUrl({
                action: "read",
                expires: "03-01-2500",
            });
            let thumbnailUrl = null;
            if (file.mimetype.startsWith("image/")) {
                try {
                    const thumbnailBuffer = await (0, sharp_1.default)(fileBuffer)
                        .resize(200, 200, { fit: "inside", withoutEnlargement: true })
                        .jpeg({ quality: 80 })
                        .toBuffer();
                    const thumbnailPath = `users/${userId}/thumbnails/${fileId}.jpg`;
                    const thumbnailUpload = firebase_1.bucket.file(thumbnailPath);
                    await thumbnailUpload.save(thumbnailBuffer, {
                        metadata: {
                            contentType: "image/jpeg",
                        },
                    });
                    const [thumbnailSignedUrl] = await thumbnailUpload.getSignedUrl({
                        action: "read",
                        expires: "03-01-2500",
                    });
                    thumbnailUrl = thumbnailSignedUrl;
                }
                catch (thumbnailError) {
                    console.error("Thumbnail generation error:", thumbnailError);
                }
            }
            const result = await connection_1.default.query(`INSERT INTO files (
          id, name, original_name, mime_type, size, folder_id, owner_id, 
          firebase_path, firebase_url, thumbnail_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        RETURNING *`, [
                fileId,
                fileName,
                file.originalname,
                file.mimetype,
                file.size,
                folderId || null,
                userId,
                firebasePath,
                url,
                thumbnailUrl,
            ]);
            await connection_1.default.query("UPDATE users SET storage_used = storage_used + $1 WHERE id = $2", [file.size, userId]);
            const savedFile = result.rows[0];
            res.status(201).json({
                message: "File uploaded successfully",
                file: {
                    id: savedFile.id,
                    name: savedFile.name,
                    originalName: savedFile.original_name,
                    mimeType: savedFile.mime_type,
                    size: savedFile.size,
                    folderId: savedFile.folder_id,
                    firebaseUrl: savedFile.firebase_url,
                    thumbnailUrl: savedFile.thumbnail_url,
                    createdAt: savedFile.created_at,
                },
            });
        });
    }
    catch (error) {
        console.error("File upload error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.uploadFile = uploadFile;
const getFiles = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        const { folderId, page = "1", limit = "20", search, sortBy = "created_at", sortOrder = "desc", } = req.query;
        const userId = req.user.id;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let query = `
      SELECT f.*, 
             CASE WHEN f.folder_id IS NULL THEN 'root' ELSE 'folder' END as location_type
      FROM files f
      WHERE f.owner_id = $1 AND f.is_deleted = FALSE
    `;
        const queryParams = [userId];
        let paramCount = 1;
        if (folderId) {
            paramCount++;
            query += ` AND f.folder_id = $${paramCount}`;
            queryParams.push(folderId);
        }
        else if (folderId === "root") {
            query += ` AND f.folder_id IS NULL`;
        }
        if (search) {
            paramCount++;
            query += ` AND (
        f.name ILIKE $${paramCount} OR 
        f.original_name ILIKE $${paramCount}
      )`;
            queryParams.push(`%${search}%`);
        }
        const validSortFields = ["name", "size", "created_at", "updated_at"];
        const validSortOrders = ["asc", "desc"];
        if (validSortFields.includes(sortBy)) {
            query += ` ORDER BY f.${sortBy}`;
            if (typeof sortOrder === "string") {
                query += ` ${sortOrder.toUpperCase()}`;
            }
        }
        else {
            query += ` ORDER BY f.created_at DESC`;
        }
        query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        queryParams.push(parseInt(limit), offset);
        const result = await connection_1.default.query(query, queryParams);
        let countQuery = `
      SELECT COUNT(*) FROM files f 
      WHERE f.owner_id = $1 AND f.is_deleted = FALSE
    `;
        const countParams = [userId];
        if (folderId) {
            countQuery += ` AND f.folder_id = $2`;
            countParams.push(folderId);
        }
        else if (folderId === "root") {
            countQuery += ` AND f.folder_id IS NULL`;
        }
        if (search) {
            countQuery += ` AND (
        f.name ILIKE $${countParams.length + 1} OR 
        f.original_name ILIKE $${countParams.length + 1}
      )`;
            countParams.push(`%${search}%`);
        }
        const countResult = await connection_1.default.query(countQuery, countParams);
        const totalCount = parseInt(countResult.rows[0].count);
        res.json({
            files: result.rows.map((file) => ({
                id: file.id,
                name: file.name,
                originalName: file.original_name,
                mimeType: file.mime_type,
                size: file.size,
                folderId: file.folder_id,
                firebaseUrl: file.firebase_url,
                thumbnailUrl: file.thumbnail_url,
                createdAt: file.created_at,
                updatedAt: file.updated_at,
                locationType: file.location_type,
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / parseInt(limit)),
            },
        });
    }
    catch (error) {
        console.error("Get files error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getFiles = getFiles;
const deleteFile = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        const { fileId } = req.params;
        const userId = req.user.id;
        const fileResult = await connection_1.default.query("SELECT id, size, firebase_path FROM files WHERE id = $1 AND owner_id = $2 AND is_deleted = FALSE", [fileId, userId]);
        if (fileResult.rows.length === 0) {
            res.status(404).json({ error: "File not found" });
            return;
        }
        const file = fileResult.rows[0];
        await connection_1.default.query("UPDATE files SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP WHERE id = $1", [fileId]);
        await connection_1.default.query("UPDATE users SET storage_used = storage_used - $1 WHERE id = $2", [file.size, userId]);
        res.json({ message: "File deleted successfully" });
    }
    catch (error) {
        console.error("Delete file error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.deleteFile = deleteFile;
const restoreFile = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        const { fileId } = req.params;
        const userId = req.user.id;
        const fileResult = await connection_1.default.query("SELECT id, size FROM files WHERE id = $1 AND owner_id = $2 AND is_deleted = TRUE", [fileId, userId]);
        if (fileResult.rows.length === 0) {
            res.status(404).json({ error: "File not found" });
            return;
        }
        const file = fileResult.rows[0];
        const userResult = await connection_1.default.query("SELECT storage_used, storage_limit FROM users WHERE id = $1", [userId]);
        if (userResult.rows.length === 0) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        const { storage_used, storage_limit } = userResult.rows[0];
        if (storage_used + file.size > storage_limit) {
            res.status(413).json({ error: "Storage limit exceeded" });
            return;
        }
        await connection_1.default.query("UPDATE files SET is_deleted = FALSE, deleted_at = NULL WHERE id = $1", [fileId]);
        await connection_1.default.query("UPDATE users SET storage_used = storage_used + $1 WHERE id = $2", [file.size, userId]);
        res.json({ message: "File restored successfully" });
    }
    catch (error) {
        console.error("Restore file error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.restoreFile = restoreFile;
const getTrash = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }
        const { page = "1", limit = "20" } = req.query;
        const userId = req.user.id;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const result = await connection_1.default.query(`SELECT * FROM files 
       WHERE owner_id = $1 AND is_deleted = TRUE 
       ORDER BY deleted_at DESC 
       LIMIT $2 OFFSET $3`, [userId, parseInt(limit), offset]);
        const countResult = await connection_1.default.query("SELECT COUNT(*) FROM files WHERE owner_id = $1 AND is_deleted = TRUE", [userId]);
        const totalCount = parseInt(countResult.rows[0].count);
        res.json({
            files: result.rows.map((file) => ({
                id: file.id,
                name: file.name,
                originalName: file.original_name,
                mimeType: file.mime_type,
                size: file.size,
                deletedAt: file.deleted_at,
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / parseInt(limit)),
            },
        });
    }
    catch (error) {
        console.error("Get trash error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getTrash = getTrash;
//# sourceMappingURL=fileController.js.map