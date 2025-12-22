import { Server, Socket } from "socket.io";

// 型定義
interface User {
  id: string;
  name: string;
  avatar: string;
  position: { x: number; y: number };
  isScreenSharing: boolean;
  screenShareSize?: { width: number; height: number };
}

interface RoomState {
  users: User[];
  chatHistory: ChatMessage[];
  backgroundImage?: string;
}

interface ChatMessage {
  id: string;
  message: string;
  sender: string;
  timestamp: number;
  zoneId?: string;
}

export function setupSocketIO(io: Server) {
  // メモリ上での状態管理
  // 本番環境ではRedis等を使うべきだが、開発環境ではメモリで十分
  const rooms: Record<string, RoomState> = {};
  const socketToRoom: Record<string, string> = {};

  io.on("connection", (socket: Socket) => {
    console.log(`[Connection] New client connected: ${socket.id}`);

    // クライアントに接続確認（Ping/Pong）を送る
    socket.emit("connection-ack", { socketId: socket.id });

    // 入室リクエスト処理
    socket.on("join-room", (payload: { roomId: string; user: { name: string; avatar: string } }) => {
      const { roomId, user } = payload;
      
      // 既存の部屋から退出（もし入っていれば）
      const currentRoom = socketToRoom[socket.id];
      if (currentRoom) {
        leaveRoom(socket, currentRoom);
      }

      console.log(`[Join] User ${socket.id} (${user.name}) joining room: ${roomId}`);

      // 部屋の初期化
      if (!rooms[roomId]) {
        rooms[roomId] = {
          users: [],
          chatHistory: [],
          backgroundImage: undefined
        };
      }

      // ユーザーオブジェクト作成
      const newUser: User = {
        id: socket.id,
        name: user.name || "Guest",
        avatar: user.avatar || "default",
        position: { x: Math.random() * 500 + 100, y: Math.random() * 500 + 100 }, // 重ならないように少しオフセット
        isScreenSharing: false,
        screenShareSize: { width: 480, height: 360 }
      };

      // 部屋にユーザーを追加
      rooms[roomId].users.push(newUser);
      socketToRoom[socket.id] = roomId;
      socket.join(roomId);

      // 自分自身に「現在の部屋の全状態」を送信（同期）
      socket.emit("room-state-sync", {
        users: rooms[roomId].users,
        chatHistory: rooms[roomId].chatHistory,
        myUser: newUser,
        backgroundImage: rooms[roomId].backgroundImage
      });

      // 他のメンバーに「新しいユーザーが入った」ことを通知
      socket.to(roomId).emit("user-joined", newUser);

      console.log(`[Room Status] Room ${roomId} has ${rooms[roomId].users.length} users`);
    });

    // 移動同期
    socket.on("user-move", (position: { x: number; y: number }) => {
      const roomId = socketToRoom[socket.id];
      if (!roomId || !rooms[roomId]) return;

      const user = rooms[roomId].users.find(u => u.id === socket.id);
      if (user) {
        user.position = position;
        // 自分以外の全員に位置更新を通知
        socket.to(roomId).emit("user-moved", { id: socket.id, position });
      }
    });

    // チャット送信
    socket.on("send-message", (payload: { message: string; sender: string; zoneId?: string }) => {
      const roomId = socketToRoom[socket.id];
      if (!roomId || !rooms[roomId]) return;

      const newMessage: ChatMessage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        message: payload.message,
        sender: payload.sender,
        timestamp: Date.now(),
        zoneId: payload.zoneId
      };

      // 履歴に保存（最大50件）
      rooms[roomId].chatHistory.push(newMessage);
      if (rooms[roomId].chatHistory.length > 50) {
        rooms[roomId].chatHistory.shift();
      }

      // 全員（自分含む）に送信
      io.in(roomId).emit("receive-message", newMessage);
    });

    // リアクション送信
    socket.on("send-reaction", (payload: { emoji: string; position: { x: number; y: number } }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        io.in(roomId).emit("receive-reaction", {
          id: socket.id,
          emoji: payload.emoji,
          position: payload.position
        });
      }
    });

    // 背景画像変更
    socket.on("change-background", (url: string) => {
      const roomId = socketToRoom[socket.id];
      if (!roomId || !rooms[roomId]) return;

      rooms[roomId].backgroundImage = url;
      io.in(roomId).emit("background-updated", url);
    });

    // 画面共有状態の更新
    socket.on("screen-share-state", (isScreenSharing: boolean) => {
      const roomId = socketToRoom[socket.id];
      if (!roomId || !rooms[roomId]) return;

      const user = rooms[roomId].users.find(u => u.id === socket.id);
      if (user) {
        user.isScreenSharing = isScreenSharing;
        socket.to(roomId).emit("user-screen-share-state", { id: socket.id, isScreenSharing });
      }
    });

    // 画面共有サイズの更新
    socket.on("screen-share-size", (size: { width: number; height: number }) => {
      const roomId = socketToRoom[socket.id];
      if (!roomId || !rooms[roomId]) return;

      const user = rooms[roomId].users.find(u => u.id === socket.id);
      if (user) {
        user.screenShareSize = size;
        socket.to(roomId).emit("user-screen-share-size", { id: socket.id, size });
      }
    });

    // WebRTC シグナリング
    socket.on("sending-signal", (payload) => {
      io.to(payload.userToSignal).emit("user-joined-signal", { signal: payload.signal, callerID: payload.callerID });
    });

    socket.on("returning-signal", (payload) => {
      io.to(payload.callerID).emit("receiving-returned-signal", { signal: payload.signal, id: socket.id });
    });

    // 切断処理
    socket.on("disconnect", () => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        leaveRoom(socket, roomId);
      }
      console.log(`[Disconnect] Client disconnected: ${socket.id}`);
    });

    // 退出処理（明示的）
    socket.on("leave-room", () => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        leaveRoom(socket, roomId);
      }
    });
  });

  // 共通の退出ロジック
  function leaveRoom(socket: Socket, roomId: string) {
    if (!rooms[roomId]) return;

    // ユーザーリストから削除
    rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== socket.id);
    
    // 部屋の他のメンバーに通知
    socket.to(roomId).emit("user-left", socket.id);
    
    // Socketの部屋から退出
    socket.leave(roomId);
    delete socketToRoom[socket.id];

    console.log(`[Leave] User ${socket.id} left room: ${roomId}`);

    // 部屋が空になったら削除（メモリリーク防止）
    if (rooms[roomId].users.length === 0) {
      delete rooms[roomId];
      console.log(`[Room Closed] Room ${roomId} is empty and deleted`);
    }
  }
}
