// ---------------------------------------------------------------------------
// Notification WebSocket Handler — Socket.io namespace for real-time delivery
// E9-2 Task 1.1
// ---------------------------------------------------------------------------

import { Server as SocketServer, type Socket } from 'socket.io';
import type { Logger } from 'pino';

import { verifyAccessToken } from '../../../core/auth/auth.service.js';

// ─── Authenticated socket data ──────────────────────────────────────────────

interface AuthenticatedSocketData {
  userId: string;
  tenantId: string;
}

// ─── Module-level singleton for standalone push functions ────────────────────
//
// WARNING: This singleton is process-local. In a multi-process deployment
// (PM2 cluster, Kubernetes multi-pod), pushNotificationToUser() only reaches
// sockets connected to THIS process. For production horizontal scaling, add
// @socket.io/redis-adapter to broadcast across processes via Redis pub/sub.
// See: https://socket.io/docs/v4/redis-adapter/

let handlerInstance: NotificationWebSocketHandler | null = null;

// ─── WebSocket Handler ──────────────────────────────────────────────────────

export class NotificationWebSocketHandler {
  private io: SocketServer | null = null;
  private ownsServer = false; // true if we created the SocketServer (vs borrowing)
  private connectedSockets = new Map<string, Set<Socket>>();

  constructor(private logger: Logger) {
    if (handlerInstance !== null) {
      logger.warn(
        'NotificationWebSocketHandler: overwriting existing singleton instance — only one handler should exist per process',
      );
    }
    handlerInstance = this;
  }

  /**
   * Attach to an existing Socket.io Server instance or create a new one.
   *
   * Accepts either a SocketServer (to reuse an existing instance sharing the
   * same Engine.io path) or a raw HTTP server (creates a dedicated SocketServer
   * with path `/api/v1/notifications/ws`).
   *
   * NOTE: The AI chat handler (E5b) uses a separate SocketServer with path
   * `/api/v1/ai/chat`. Because Socket.io's `path` is the Engine.io transport
   * endpoint, sharing a single SocketServer requires all clients to connect to
   * the same path. Since the AI and notification frontends use different paths,
   * they each need their own SocketServer instance. Two SocketServer instances
   * with different paths on the same HTTP server is a supported Socket.io
   * configuration — each registers a separate HTTP upgrade handler.
   */
  attach(serverOrHttp: SocketServer | unknown): void {
    if (serverOrHttp instanceof SocketServer) {
      // Reuse an existing Socket.io Server (same Engine.io path)
      this.io = serverOrHttp;
      this.ownsServer = false;
    } else {
      // Create a new Socket.io Server on this HTTP server
      const corsOrigin = process.env.CORS_ORIGIN ?? '*';
      this.ownsServer = true;
      this.io = new SocketServer(serverOrHttp as ConstructorParameters<typeof SocketServer>[0], {
        cors: {
          origin: corsOrigin === '*' ? true : corsOrigin.split(','),
          credentials: corsOrigin !== '*',
        },
        path: '/api/v1/notifications/ws',
        transports: ['websocket', 'polling'],
      });
    }

    const notifNs = this.io.of('/notifications');
    notifNs.use((socket, next) => this.authenticateSocket(socket, next));
    notifNs.on('connection', (socket) => this.handleConnection(socket));

    this.logger.info('Notification WebSocket handler attached at /notifications namespace');
  }

  /**
   * JWT authentication middleware for Socket.io.
   * Validates JWT from handshake auth.token field.
   * Notifications are user-scoped (no companyId needed per Architecture §2.29).
   */
  private async authenticateSocket(socket: Socket, next: (err?: Error) => void): Promise<void> {
    try {
      const token =
        ((socket.handshake.auth as Record<string, unknown>)?.token as string | undefined) ??
        (socket.handshake.query?.token as string | undefined);

      if (!token) {
        const err = new Error('Authentication required');
        (err as any).data = { message: 'Authentication required', code: 'AUTH_REQUIRED' };
        return next(err);
      }

      const payload = await verifyAccessToken(token);

      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new Error('Missing or invalid sub claim');
      }
      if (typeof payload.tenantId !== 'string' || payload.tenantId.length === 0) {
        throw new Error('Missing or invalid tenantId claim');
      }

      socket.data = {
        userId: payload.sub,
        tenantId: payload.tenantId,
      } satisfies AuthenticatedSocketData;

      next();
    } catch {
      const err = new Error('Authentication required');
      (err as any).data = { message: 'Authentication required', code: 'AUTH_REQUIRED' };
      next(err);
    }
  }

  /**
   * Handle an authenticated client connection.
   * Joins user:{userId} room and tracks socket for multi-tab support.
   */
  private handleConnection(socket: Socket): void {
    const data = socket.data as AuthenticatedSocketData;

    this.logger.info(
      { userId: data.userId, socketId: socket.id },
      'Notification WebSocket client connected',
    );

    // Join user-specific room for targeted push
    const room = `user:${data.userId}`;
    void socket.join(room);

    // Track socket for multi-tab scenarios
    let userSockets = this.connectedSockets.get(data.userId);
    if (!userSockets) {
      userSockets = new Set();
      this.connectedSockets.set(data.userId, userSockets);
    }
    userSockets.add(socket);

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      this.logger.info(
        { userId: data.userId, socketId: socket.id, reason },
        'Notification WebSocket client disconnected',
      );

      const sockets = this.connectedSockets.get(data.userId);
      if (sockets) {
        sockets.delete(socket);
        if (sockets.size === 0) {
          this.connectedSockets.delete(data.userId);
        }
      }
    });
  }

  /**
   * Push a notification to all connected sockets for a user.
   * Emits `notification:new` event to the user:{userId} room.
   */
  pushNotificationToUser(userId: string, notification: object): void {
    if (!this.io) return;
    this.io.of('/notifications').to(`user:${userId}`).emit('notification:new', notification);
  }

  /**
   * Push the updated unread count to all connected sockets for a user.
   * Emits `notification:unread-count` event to the user:{userId} room.
   */
  pushUnreadCountToUser(userId: string, count: number): void {
    if (!this.io) return;
    this.io.of('/notifications').to(`user:${userId}`).emit('notification:unread-count', { count });
  }

  /**
   * Graceful shutdown — disconnect all notification sockets.
   * Only closes the SocketServer if we created it (ownsServer).
   * If borrowing a shared server, just disconnect our namespace sockets.
   */
  async close(): Promise<void> {
    if (!this.io) return;

    // Disconnect all sockets in our namespace
    const notifNs = this.io.of('/notifications');
    notifNs.disconnectSockets(true);
    this.connectedSockets.clear();

    // Only close the SocketServer if we own it
    if (this.ownsServer) {
      await new Promise<void>((resolve) => {
        this.io!.close(() => {
          this.logger.info('Notification WebSocket server closed');
          resolve();
        });
      });
    } else {
      this.logger.info('Notification WebSocket namespace cleaned up (shared server)');
    }

    this.io = null;
    if (handlerInstance === this) {
      handlerInstance = null;
    }
  }

  /** Expose the Socket.io server instance for testing */
  getServer(): SocketServer | null {
    return this.io;
  }

  /** Get count of users with active connections (for monitoring) */
  getConnectedUserCount(): number {
    return this.connectedSockets.size;
  }
}

// ─── Standalone push functions (for use by dispatch worker) ─────────────────

/**
 * Push a notification to a user via WebSocket.
 * No-op if no handler is initialised (graceful degradation).
 */
export function pushNotificationToUser(userId: string, notification: object): void {
  handlerInstance?.pushNotificationToUser(userId, notification);
}

/**
 * Push updated unread count to a user via WebSocket.
 * No-op if no handler is initialised (graceful degradation).
 */
export function pushUnreadCountToUser(userId: string, count: number): void {
  handlerInstance?.pushUnreadCountToUser(userId, count);
}
