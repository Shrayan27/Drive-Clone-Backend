"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborationServer = void 0;
const socket_io_1 = require("socket.io");
const auth_1 = require("../middleware/auth");
class CollaborationServer {
    constructor(server) {
        this.users = new Map();
        this.fileCollaborations = new Map();
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: process.env.CLIENT_URL || "https://drive-clone-backend-7ojr.onrender.com",
                methods: ["GET", "POST"],
                credentials: true
            }
        });
        this.setupMiddleware();
        this.setupEventHandlers();
    }
    setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    return next(new Error('Authentication error'));
                }
                const decoded = await (0, auth_1.verifyToken)(token);
                if (!decoded) {
                    return next(new Error('Invalid token'));
                }
                socket.data.user = decoded;
                next();
            }
            catch (error) {
                next(new Error('Authentication error'));
            }
        });
    }
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`User connected: ${socket.data.user.email}`);
            socket.join(`user:${socket.data.user.uid}`);
            socket.on('join-file', (fileId) => {
                this.handleJoinFile(socket, fileId);
            });
            socket.on('leave-file', (fileId) => {
                this.handleLeaveFile(socket, fileId);
            });
            socket.on('cursor-update', (data) => {
                this.handleCursorUpdate(socket, data);
            });
            socket.on('selection-update', (data) => {
                this.handleSelectionUpdate(socket, data);
            });
            socket.on('text-change', (data) => {
                this.handleTextChange(socket, data);
            });
            socket.on('typing-start', (fileId) => {
                this.handleTypingStart(socket, fileId);
            });
            socket.on('typing-stop', (fileId) => {
                this.handleTypingStop(socket, fileId);
            });
            socket.on('presence-update', (data) => {
                this.handlePresenceUpdate(socket, data);
            });
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }
    handleJoinFile(socket, fileId) {
        const user = {
            id: socket.data.user.uid,
            email: socket.data.user.email,
            displayName: socket.data.user.displayName || socket.data.user.email,
            socketId: socket.id,
            currentFile: fileId
        };
        if (!this.fileCollaborations.has(fileId)) {
            this.fileCollaborations.set(fileId, {
                fileId,
                users: [],
                cursors: new Map(),
                selections: new Map()
            });
        }
        const collaboration = this.fileCollaborations.get(fileId);
        const existingUserIndex = collaboration.users.findIndex(u => u.id === user.id);
        if (existingUserIndex >= 0) {
            collaboration.users[existingUserIndex] = user;
        }
        else {
            collaboration.users.push(user);
        }
        socket.join(`file:${fileId}`);
        socket.to(`file:${fileId}`).emit('user-joined-file', {
            user: { id: user.id, email: user.email, displayName: user.displayName },
            totalUsers: collaboration.users.length
        });
        socket.emit('file-collaboration-state', {
            users: collaboration.users.map(u => ({ id: u.id, email: u.email, displayName: u.displayName })),
            cursors: Array.from(collaboration.cursors.values()),
            selections: Array.from(collaboration.selections.values())
        });
        console.log(`User ${user.email} joined file ${fileId}`);
    }
    handleLeaveFile(socket, fileId) {
        const collaboration = this.fileCollaborations.get(fileId);
        if (!collaboration)
            return;
        collaboration.users = collaboration.users.filter(u => u.id !== socket.data.user.uid);
        collaboration.cursors.delete(socket.data.user.uid);
        collaboration.selections.delete(socket.data.user.uid);
        socket.leave(`file:${fileId}`);
        socket.to(`file:${fileId}`).emit('user-left-file', {
            userId: socket.data.user.uid,
            totalUsers: collaboration.users.length
        });
        if (collaboration.users.length === 0) {
            this.fileCollaborations.delete(fileId);
        }
        console.log(`User ${socket.data.user.email} left file ${fileId}`);
    }
    handleCursorUpdate(socket, data) {
        const collaboration = this.fileCollaborations.get(data.fileId);
        if (!collaboration)
            return;
        collaboration.cursors.set(socket.data.user.uid, {
            x: data.x,
            y: data.y,
            userId: socket.data.user.uid
        });
        socket.to(`file:${data.fileId}`).emit('cursor-updated', {
            userId: socket.data.user.uid,
            x: data.x,
            y: data.y
        });
    }
    handleSelectionUpdate(socket, data) {
        const collaboration = this.fileCollaborations.get(data.fileId);
        if (!collaboration)
            return;
        collaboration.selections.set(socket.data.user.uid, {
            start: data.start,
            end: data.end,
            userId: socket.data.user.uid
        });
        socket.to(`file:${data.fileId}`).emit('selection-updated', {
            userId: socket.data.user.uid,
            start: data.start,
            end: data.end
        });
    }
    handleTextChange(socket, data) {
        socket.to(`file:${data.fileId}`).emit('text-changed', {
            userId: socket.data.user.uid,
            changes: data.changes,
            timestamp: Date.now()
        });
    }
    handleTypingStart(socket, fileId) {
        socket.to(`file:${fileId}`).emit('user-typing', {
            userId: socket.data.user.uid,
            email: socket.data.user.email
        });
    }
    handleTypingStop(socket, fileId) {
        socket.to(`file:${fileId}`).emit('user-stopped-typing', {
            userId: socket.data.user.uid
        });
    }
    handlePresenceUpdate(socket, data) {
        this.fileCollaborations.forEach((collaboration, fileId) => {
            const user = collaboration.users.find(u => u.id === socket.data.user.uid);
            if (user) {
                socket.to(`file:${fileId}`).emit('presence-updated', {
                    userId: socket.data.user.uid,
                    status: data.status
                });
            }
        });
    }
    handleDisconnect(socket) {
        console.log(`User disconnected: ${socket.data.user.email}`);
        this.fileCollaborations.forEach((collaboration, fileId) => {
            const userIndex = collaboration.users.findIndex(u => u.id === socket.data.user.uid);
            if (userIndex >= 0) {
                collaboration.users.splice(userIndex, 1);
                collaboration.cursors.delete(socket.data.user.uid);
                collaboration.selections.delete(socket.data.user.uid);
                socket.to(`file:${fileId}`).emit('user-left-file', {
                    userId: socket.data.user.uid,
                    totalUsers: collaboration.users.length
                });
                if (collaboration.users.length === 0) {
                    this.fileCollaborations.delete(fileId);
                }
            }
        });
    }
    getConnectedUsers() {
        return this.io.engine.clientsCount;
    }
    getFileCollaboration(fileId) {
        return this.fileCollaborations.get(fileId);
    }
    broadcastToFile(fileId, event, data) {
        this.io.to(`file:${fileId}`).emit(event, data);
    }
}
exports.CollaborationServer = CollaborationServer;
//# sourceMappingURL=collaborationServer.js.map