import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifyToken } from '../middleware/auth';

interface User {
  id: string;
  email: string;
  displayName: string;
  socketId: string;
  currentFile?: string;
  currentFolder?: string;
}

interface FileCollaboration {
  fileId: string;
  users: User[];
  cursors: Map<string, { x: number; y: number; userId: string }>;
  selections: Map<string, { start: number; end: number; userId: string }>;
}

export class CollaborationServer {
  private io: SocketIOServer;
  private users: Map<string, User> = new Map();
  private fileCollaborations: Map<string, FileCollaboration> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = await verifyToken(token);
        if (!decoded) {
          return next(new Error('Invalid token'));
        }

        socket.data.user = decoded;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.data.user.email}`);

      // Join user to their personal room
      socket.join(`user:${socket.data.user.uid}`);

      // Handle user joining a file for collaboration
      socket.on('join-file', (fileId: string) => {
        this.handleJoinFile(socket, fileId);
      });

      // Handle user leaving a file
      socket.on('leave-file', (fileId: string) => {
        this.handleLeaveFile(socket, fileId);
      });

      // Handle cursor position updates
      socket.on('cursor-update', (data: { fileId: string; x: number; y: number }) => {
        this.handleCursorUpdate(socket, data);
      });

      // Handle text selection updates
      socket.on('selection-update', (data: { fileId: string; start: number; end: number }) => {
        this.handleSelectionUpdate(socket, data);
      });

      // Handle real-time text changes
      socket.on('text-change', (data: { fileId: string; changes: any[] }) => {
        this.handleTextChange(socket, data);
      });

      // Handle user typing indicator
      socket.on('typing-start', (fileId: string) => {
        this.handleTypingStart(socket, fileId);
      });

      socket.on('typing-stop', (fileId: string) => {
        this.handleTypingStop(socket, fileId);
      });

      // Handle user presence
      socket.on('presence-update', (data: { status: 'online' | 'away' | 'offline' }) => {
        this.handlePresenceUpdate(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private handleJoinFile(socket: any, fileId: string) {
    const user: User = {
      id: socket.data.user.uid,
      email: socket.data.user.email,
      displayName: socket.data.user.displayName || socket.data.user.email,
      socketId: socket.id,
      currentFile: fileId
    };

    // Add user to file collaboration
    if (!this.fileCollaborations.has(fileId)) {
      this.fileCollaborations.set(fileId, {
        fileId,
        users: [],
        cursors: new Map(),
        selections: new Map()
      });
    }

    const collaboration = this.fileCollaborations.get(fileId)!;
    const existingUserIndex = collaboration.users.findIndex(u => u.id === user.id);
    
    if (existingUserIndex >= 0) {
      collaboration.users[existingUserIndex] = user;
    } else {
      collaboration.users.push(user);
    }

    // Join the file room
    socket.join(`file:${fileId}`);
    
    // Notify other users in the file
    socket.to(`file:${fileId}`).emit('user-joined-file', {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      totalUsers: collaboration.users.length
    });

    // Send current collaboration state to the new user
    socket.emit('file-collaboration-state', {
      users: collaboration.users.map(u => ({ id: u.id, email: u.email, displayName: u.displayName })),
      cursors: Array.from(collaboration.cursors.values()),
      selections: Array.from(collaboration.selections.values())
    });

    console.log(`User ${user.email} joined file ${fileId}`);
  }

  private handleLeaveFile(socket: any, fileId: string) {
    const collaboration = this.fileCollaborations.get(fileId);
    if (!collaboration) return;

    // Remove user from file collaboration
    collaboration.users = collaboration.users.filter(u => u.id !== socket.data.user.uid);
    collaboration.cursors.delete(socket.data.user.uid);
    collaboration.selections.delete(socket.data.user.uid);

    // Leave the file room
    socket.leave(`file:${fileId}`);

    // Notify other users
    socket.to(`file:${fileId}`).emit('user-left-file', {
      userId: socket.data.user.uid,
      totalUsers: collaboration.users.length
    });

    // Clean up empty collaborations
    if (collaboration.users.length === 0) {
      this.fileCollaborations.delete(fileId);
    }

    console.log(`User ${socket.data.user.email} left file ${fileId}`);
  }

  private handleCursorUpdate(socket: any, data: { fileId: string; x: number; y: number }) {
    const collaboration = this.fileCollaborations.get(data.fileId);
    if (!collaboration) return;

    collaboration.cursors.set(socket.data.user.uid, {
      x: data.x,
      y: data.y,
      userId: socket.data.user.uid
    });

    // Broadcast cursor update to other users in the file
    socket.to(`file:${data.fileId}`).emit('cursor-updated', {
      userId: socket.data.user.uid,
      x: data.x,
      y: data.y
    });
  }

  private handleSelectionUpdate(socket: any, data: { fileId: string; start: number; end: number }) {
    const collaboration = this.fileCollaborations.get(data.fileId);
    if (!collaboration) return;

    collaboration.selections.set(socket.data.user.uid, {
      start: data.start,
      end: data.end,
      userId: socket.data.user.uid
    });

    // Broadcast selection update to other users in the file
    socket.to(`file:${data.fileId}`).emit('selection-updated', {
      userId: socket.data.user.uid,
      start: data.start,
      end: data.end
    });
  }

  private handleTextChange(socket: any, data: { fileId: string; changes: any[] }) {
    // Broadcast text changes to other users in the file
    socket.to(`file:${data.fileId}`).emit('text-changed', {
      userId: socket.data.user.uid,
      changes: data.changes,
      timestamp: Date.now()
    });
  }

  private handleTypingStart(socket: any, fileId: string) {
    socket.to(`file:${fileId}`).emit('user-typing', {
      userId: socket.data.user.uid,
      email: socket.data.user.email
    });
  }

  private handleTypingStop(socket: any, fileId: string) {
    socket.to(`file:${fileId}`).emit('user-stopped-typing', {
      userId: socket.data.user.uid
    });
  }

  private handlePresenceUpdate(socket: any, data: { status: 'online' | 'away' | 'offline' }) {
    // Update user presence in all files they're collaborating on
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

  private handleDisconnect(socket: any) {
    console.log(`User disconnected: ${socket.data.user.email}`);

    // Remove user from all file collaborations
    this.fileCollaborations.forEach((collaboration, fileId) => {
      const userIndex = collaboration.users.findIndex(u => u.id === socket.data.user.uid);
      if (userIndex >= 0) {
        collaboration.users.splice(userIndex, 1);
        collaboration.cursors.delete(socket.data.user.uid);
        collaboration.selections.delete(socket.data.user.uid);

        // Notify other users
        socket.to(`file:${fileId}`).emit('user-left-file', {
          userId: socket.data.user.uid,
          totalUsers: collaboration.users.length
        });

        // Clean up empty collaborations
        if (collaboration.users.length === 0) {
          this.fileCollaborations.delete(fileId);
        }
      }
    });
  }

  // Public methods for external use
  public getConnectedUsers(): number {
    return this.io.engine.clientsCount;
  }

  public getFileCollaboration(fileId: string): FileCollaboration | undefined {
    return this.fileCollaborations.get(fileId);
  }

  public broadcastToFile(fileId: string, event: string, data: any) {
    this.io.to(`file:${fileId}`).emit(event, data);
  }
}
