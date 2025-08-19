import { Server as HTTPServer } from 'http';
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
    cursors: Map<string, {
        x: number;
        y: number;
        userId: string;
    }>;
    selections: Map<string, {
        start: number;
        end: number;
        userId: string;
    }>;
}
export declare class CollaborationServer {
    private io;
    private users;
    private fileCollaborations;
    constructor(server: HTTPServer);
    private setupMiddleware;
    private setupEventHandlers;
    private handleJoinFile;
    private handleLeaveFile;
    private handleCursorUpdate;
    private handleSelectionUpdate;
    private handleTextChange;
    private handleTypingStart;
    private handleTypingStop;
    private handlePresenceUpdate;
    private handleDisconnect;
    getConnectedUsers(): number;
    getFileCollaboration(fileId: string): FileCollaboration | undefined;
    broadcastToFile(fileId: string, event: string, data: any): void;
}
export {};
//# sourceMappingURL=collaborationServer.d.ts.map