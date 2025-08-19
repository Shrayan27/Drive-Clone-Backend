import { Request, Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import mime from "mime-types";
import pool from "../database/connection";
import { bucket } from "../config/firebase";
import sharp from "sharp";

// Multer configuration for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || "104857600"), // 100MB default
  },
  fileFilter: (req, file, cb) => {
    // Check file type
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
    } else {
      cb(new Error("File type not allowed"));
    }
  },
});

export const uploadFile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    // Use multer middleware
    upload.single("file")(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
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

      // Check storage limit
      const userResult = await pool.query(
        "SELECT storage_used, storage_limit FROM users WHERE id = $1",
        [userId]
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const { storage_used, storage_limit } = userResult.rows[0];
      if (storage_used + file.size > storage_limit) {
        res.status(413).json({ error: "Storage limit exceeded" });
        return;
      }

      // Generate unique filename
      const fileId = uuidv4();
      const fileExtension = mime.extension(file.mimetype) || "bin";
      const fileName = name || `${fileId}.${fileExtension}`;
      const firebasePath = `users/${userId}/files/${fileId}.${fileExtension}`;

      // Upload to Firebase Storage
      const fileBuffer = file.buffer;
      const fileUpload = bucket.file(firebasePath);

      await fileUpload.save(fileBuffer, {
        metadata: {
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
            uploadedBy: userId,
          },
        },
      });

      // Generate public URL
      const [url] = await fileUpload.getSignedUrl({
        action: "read",
        expires: "03-01-2500", // Far future
      });

      // Generate thumbnail for images
      let thumbnailUrl = null;
      if (file.mimetype.startsWith("image/")) {
        try {
          const thumbnailBuffer = await sharp(fileBuffer)
            .resize(200, 200, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();

          const thumbnailPath = `users/${userId}/thumbnails/${fileId}.jpg`;
          const thumbnailUpload = bucket.file(thumbnailPath);

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
        } catch (thumbnailError) {
          console.error("Thumbnail generation error:", thumbnailError);
        }
      }

      // Save file metadata to database
      const result = await pool.query(
        `INSERT INTO files (
          id, name, original_name, mime_type, size, folder_id, owner_id, 
          firebase_path, firebase_url, thumbnail_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        RETURNING *`,
        [
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
        ]
      );

      // Update user storage usage
      await pool.query(
        "UPDATE users SET storage_used = storage_used + $1 WHERE id = $2",
        [file.size, userId]
      );

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
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const {
      folderId,
      page = "1",
      limit = "20",
      search,
      sortBy = "created_at",
      sortOrder = "desc",
    } = req.query;
    const userId = req.user.id;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = `
      SELECT f.*, 
             CASE WHEN f.folder_id IS NULL THEN 'root' ELSE 'folder' END as location_type
      FROM files f
      WHERE f.owner_id = $1 AND f.is_deleted = FALSE
    `;

    const queryParams: any[] = [userId];
    let paramCount = 1;

    if (folderId) {
      paramCount++;
      query += ` AND f.folder_id = $${paramCount}`;
      queryParams.push(folderId);
    } else if (folderId === "root") {
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

    // Add sorting
    const validSortFields = ["name", "size", "created_at", "updated_at"];
    const validSortOrders = ["asc", "desc"];

    if (validSortFields.includes(sortBy as string)) {
      query += ` ORDER BY f.${sortBy}`;
      if (typeof sortOrder === "string") {
        query += ` ${sortOrder.toUpperCase()}`;
      }
    } else {
      query += ` ORDER BY f.created_at DESC`;
    }

    // Add pagination
    query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(parseInt(limit as string), offset);

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) FROM files f 
      WHERE f.owner_id = $1 AND f.is_deleted = FALSE
    `;
    const countParams: any[] = [userId];

    if (folderId) {
      countQuery += ` AND f.folder_id = $2`;
      countParams.push(folderId);
    } else if (folderId === "root") {
      countQuery += ` AND f.folder_id IS NULL`;
    }

    if (search) {
      countQuery += ` AND (
        f.name ILIKE $${countParams.length + 1} OR 
        f.original_name ILIKE $${countParams.length + 1}
      )`;
      countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
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
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Get files error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteFile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const { fileId } = req.params;
    const userId = req.user.id;

    // Check if file exists and user owns it
    const fileResult = await pool.query(
      "SELECT id, size, firebase_path FROM files WHERE id = $1 AND owner_id = $2 AND is_deleted = FALSE",
      [fileId, userId]
    );

    if (fileResult.rows.length === 0) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const file = fileResult.rows[0];

    // Soft delete - mark as deleted
    await pool.query(
      "UPDATE files SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP WHERE id = $1",
      [fileId]
    );

    // Update user storage usage
    await pool.query(
      "UPDATE users SET storage_used = storage_used - $1 WHERE id = $2",
      [file.size, userId]
    );

    res.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Delete file error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const restoreFile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const { fileId } = req.params;
    const userId = req.user.id;

    // Check if file exists and user owns it
    const fileResult = await pool.query(
      "SELECT id, size FROM files WHERE id = $1 AND owner_id = $2 AND is_deleted = TRUE",
      [fileId, userId]
    );

    if (fileResult.rows.length === 0) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const file = fileResult.rows[0];

    // Check storage limit before restoring
    const userResult = await pool.query(
      "SELECT storage_used, storage_limit FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const { storage_used, storage_limit } = userResult.rows[0];
    if (storage_used + file.size > storage_limit) {
      res.status(413).json({ error: "Storage limit exceeded" });
      return;
    }

    // Restore file
    await pool.query(
      "UPDATE files SET is_deleted = FALSE, deleted_at = NULL WHERE id = $1",
      [fileId]
    );

    // Update user storage usage
    await pool.query(
      "UPDATE users SET storage_used = storage_used + $1 WHERE id = $2",
      [file.size, userId]
    );

    res.json({ message: "File restored successfully" });
  } catch (error) {
    console.error("Restore file error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getTrash = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const { page = "1", limit = "20" } = req.query;
    const userId = req.user.id;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const result = await pool.query(
      `SELECT * FROM files 
       WHERE owner_id = $1 AND is_deleted = TRUE 
       ORDER BY deleted_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit as string), offset]
    );

    // Get total count
    const countResult = await pool.query(
      "SELECT COUNT(*) FROM files WHERE owner_id = $1 AND is_deleted = TRUE",
      [userId]
    );
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
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Get trash error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
