import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import { toast } from 'sonner';
import { VideoProcessor, VideoEffect } from '@/lib/videoProcessor';

// --- 型定義 ---

interface Position {
  x: number;
  y: number;
}

interface User {
  id: string;
  name: string;
  avatar: string;
  position: Position;
  stream?: MediaStream;
  isScreenSharing: boolean;
  screenShareSize?: { width: number; height: number };
}

interface ChatMessage {
  id: string;
  message: string;
  sender: string;
  timestamp: number;
  zoneId?: string;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'joined';

interface SocketContextType {
  socket: Socket | null;
  status: ConnectionStatus;
  users: User[];
  currentUser: User | null;
  messages: ChatMessage[];
  joinRoom: (roomId: string, name: string) => void;
  moveUser: (position: Position) => void;
  sendMessage: (text: string, zoneId?: string) => void;
  localStream: MediaStream | null;
  toggleAudio: () => void;
  toggleVideo: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  updateScreenShareSize: (width: number, height: number) => void;
  setBackgroundImage: (url: string) => void;
  backgroundImage: string | null;
  sendReaction: (emoji: string) => void;
  reactions: { id: string; emoji: string; x: number; y: number }[];
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  setAvatar: (avatar: string) => void;
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  selectedAudioDevice: string;
  selectedVideoDevice: string;
  setAudioDevice: (deviceId: string) => void;
  setVideoDevice: (deviceId: string) => void;
  roomId: string | null;
  setVideoEffect: (effect: VideoEffect) => void;
  setVideoEffectImage: (url: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- State ---
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  
  // Media State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [backgroundImage, setBgImage] = useState<string | null>(null);
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number; y: number }[]>([]);
  const [avatar, setAvatar] = useState<string>("default");
  
  // Devices
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("");
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>("");

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<{ peerID: string; peer: Peer.Instance }[]>([]);
  const userStreamRef = useRef<MediaStream | null>(null);
  const videoProcessorRef = useRef<VideoProcessor | null>(null);
  const originalStreamRef = useRef<MediaStream | null>(null); // 加工前の元ストリーム保持用

  // --- 初期化: メディアデバイスとSocket接続 ---
  useEffect(() => {
    // 1. メディア初期化
    const initMedia = async () => {
      try {
        // まず許可を取得してストリームを開始
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        originalStreamRef.current = stream;
        setLocalStream(stream);
        userStreamRef.current = stream;

        // VideoProcessorの初期化
        videoProcessorRef.current = new VideoProcessor();

        // 許可取得後、デバイスリストを取得（ラベルが正しく取得できる）
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        
        setAudioDevices(audioInputs);
        setVideoDevices(videoInputs);

        // デフォルトデバイスを設定
        if (audioInputs.length > 0 && !selectedAudioDevice) {
          setSelectedAudioDevice(audioInputs[0].deviceId);
        }
        if (videoInputs.length > 0 && !selectedVideoDevice) {
          setSelectedVideoDevice(videoInputs[0].deviceId);
        }

        console.log('[Media] Devices loaded:', { audio: audioInputs.length, video: videoInputs.length });
      } catch (err) {
        console.error("Media access failed, using fallback:", err);
        
        // エラーの種類に応じたメッセージ
        if (err instanceof Error) {
          if (err.name === 'NotReadableError') {
            console.error('[Media] デバイスが他のアプリケーションで使用中の可能性があります');
          } else if (err.name === 'NotAllowedError') {
            console.error('[Media] カメラ・マイクへのアクセスが拒否されました');
          } else if (err.name === 'NotFoundError') {
            console.error('[Media] カメラまたはマイクが見つかりません');
          }
        }
        
        // Fallback: Dummy stream
        const canvas = document.createElement('canvas');
        canvas.width = 640; canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) { ctx.fillStyle = '#333'; ctx.fillRect(0,0,640,480); }
        const stream = canvas.captureStream(30);
        // Dummy audio
        const audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        stream.addTrack(dest.stream.getAudioTracks()[0]);
        
        setLocalStream(stream);
        userStreamRef.current = stream;
        
        // フォールバック時もデバイスリストを試行取得
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
          setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
        } catch (enumErr) {
          console.error('[Media] デバイスリスト取得失敗:', enumErr);
        }
      }
    };
    initMedia();

    // 2. Socket接続（本番環境対応）
    const socketUrl = window.location.origin; // 現在のオリジンを使用
    const newSocket = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id);
      setStatus('connected');
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setStatus('disconnected');
      setUsers([]); // 切断時はユーザーリストをクリア
    });

    newSocket.on('connect_error', (err) => {
      console.error('[Socket] Connection Error:', err);
      setStatus('disconnected');
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      if (userStreamRef.current) {
        userStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // --- イベントリスナー設定 (Socket接続後) ---
  useEffect(() => {
    if (!socket) return;

    // 部屋の状態同期（入室直後）
    socket.on('room-state-sync', (payload: { users: User[], chatHistory: ChatMessage[], myUser: User, backgroundImage?: string }) => {
      console.log('[Sync] Room state received:', payload);
      setUsers(payload.users.filter(u => u.id !== socket.id)); // 自分以外
      setMessages(payload.chatHistory);
      setCurrentUser(payload.myUser);
      if (payload.backgroundImage) {
        setBgImage(payload.backgroundImage);
      }
      setStatus('joined');
      toast.success('ルームに入室しました');

      // 既存ユーザーとのP2P接続開始
      payload.users.forEach(user => {
        if (user.id !== socket.id) {
          const peer = createPeer(user.id, socket.id!, userStreamRef.current!);
          peersRef.current.push({ peerID: user.id, peer });
        }
      });
    });

    // 新規ユーザー参加
    socket.on('user-joined', (newUser: User) => {
      console.log('[Event] User joined:', newUser);
      setUsers(prev => [...prev, newUser]);
      toast.info(`${newUser.name}さんが入室しました`);
      // P2P接続は 'user-joined-signal' でハンドリングされるためここでは行わない
    });

    // ユーザー移動
    socket.on('user-moved', (payload: { id: string, position: Position }) => {
      setUsers(prev => prev.map(u => u.id === payload.id ? { ...u, position: payload.position } : u));
    });

    // 画面共有状態の更新
    socket.on('user-screen-share-state', (payload: { id: string, isScreenSharing: boolean }) => {
      setUsers(prev => prev.map(u => u.id === payload.id ? { ...u, isScreenSharing: payload.isScreenSharing } : u));
    });

    // 画面共有サイズの更新
    socket.on('user-screen-share-size', (payload: { id: string, size: { width: number, height: number } }) => {
      setUsers(prev => prev.map(u => u.id === payload.id ? { ...u, screenShareSize: payload.size } : u));
    });

    // チャット受信
    socket.on('receive-message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    // ユーザー退出
    socket.on('user-left', (userId: string) => {
      console.log('[Event] User left:', userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      
      // Peer破棄
      const peerObj = peersRef.current.find(p => p.peerID === userId);
      if (peerObj) {
        peerObj.peer.destroy();
        peersRef.current = peersRef.current.filter(p => p.peerID !== userId);
      }
    });

    // 背景画像更新
    socket.on('background-updated', (url: string) => {
      setBgImage(url);
      toast.info('背景画像が変更されました');
    });

    // WebRTC Signaling
    socket.on("user-joined-signal", (payload: { signal: any; callerID: string }) => {
      const peer = addPeer(payload.signal, payload.callerID, userStreamRef.current!);
      peersRef.current.push({ peerID: payload.callerID, peer });
    });

    socket.on("receiving-returned-signal", (payload: { signal: any; id: string }) => {
      const item = peersRef.current.find(p => p.peerID === payload.id);
      if (item) {
        item.peer.signal(payload.signal);
      }
    });

    // Cleanup listeners on unmount
    return () => {
      socket.off('room-state-sync');
      socket.off('user-joined');
      socket.off('user-moved');
      socket.off('receive-message');
      socket.off('user-left');
      socket.off('user-joined-signal');
      socket.off('receiving-returned-signal');
    };
  }, [socket]);

  // --- アクション ---

  const joinRoom = (newRoomId: string, name: string) => {
    if (!socket) return;
    
    // 状態リセット
    setUsers([]);
    setMessages([]);
    peersRef.current.forEach(p => p.peer.destroy());
    peersRef.current = [];
    
    setRoomId(newRoomId);
    setStatus('connecting');
    
    socket.emit('join-room', { 
      roomId: newRoomId, 
      user: { name, avatar } 
    });
  };

  const moveUser = (position: Position) => {
    if (!socket || status !== 'joined') return;
    setCurrentUser(prev => prev ? { ...prev, position } : null);
    socket.emit('user-move', position);
  };

  const sendMessage = (text: string, zoneId?: string) => {
    if (!socket || status !== 'joined') return;
    socket.emit('send-message', { 
      message: text, 
      sender: currentUser?.name || 'Guest',
      zoneId 
    });
  };

  // --- WebRTC Helpers ---

  function createPeer(userToSignal: string, callerID: string, stream: MediaStream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on("signal", signal => {
      socketRef.current?.emit("sending-signal", { userToSignal, callerID, signal });
    });

    peer.on("stream", stream => {
        setUsers(prev => prev.map(u => u.id === userToSignal ? { ...u, stream } : u));
    });

    return peer;
  }

  function addPeer(incomingSignal: any, callerID: string, stream: MediaStream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on("signal", signal => {
      socketRef.current?.emit("returning-signal", { signal, callerID });
    });

    peer.on("stream", stream => {
        setUsers(prev => prev.map(u => u.id === callerID ? { ...u, stream } : u));
    });

    peer.signal(incomingSignal);

    return peer;
  }

  // --- Media Controls (Simplified) ---
  const toggleAudio = () => {
    if (localStream) {
      const track = localStream.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsAudioEnabled(track.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const track = localStream.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsVideoEnabled(track.enabled);
      }
    }
  };

  // --- Screen Share ---
  const startScreenShare = async () => {
    try {
      // VideoProcessorが動いていたら一時停止
      if (videoProcessorRef.current) {
        videoProcessorRef.current.stop();
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      
      // 画面共有終了時の処理（ブラウザの「共有を停止」ボタン対応）
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      // 既存のP2P接続の映像トラックを画面共有のトラックに置換
      const videoTrack = screenStream.getVideoTracks()[0];
      peersRef.current.forEach(({ peer }) => {
        // simple-peerのreplaceTrackメソッドを使用
        // @ts-ignore - simple-peer types might be missing replaceTrack
        if (peer.replaceTrack && localStream) {
          const oldTrack = localStream.getVideoTracks()[0];
          if (oldTrack) {
            // @ts-ignore
            peer.replaceTrack(oldTrack, videoTrack, localStream);
          }
        }
      });

      setLocalStream(screenStream); // ローカル表示も画面共有に切り替え
      setIsScreenSharing(true);
      
      // 自分の状態を更新（アイコン表示など用）
      if (socket) {
        socket.emit('screen-share-state', true);
        // 初期サイズを送信
        socket.emit('screen-share-size', { width: 480, height: 360 });
      }
      
    } catch (err: any) {
      console.error("Failed to start screen share:", err);
      if (err.name === 'NotAllowedError' && err.message.includes('Permissions Policy')) {
        toast.error("この環境では画面共有が許可されていません。ブラウザの別タブで開いてお試しください。");
      } else if (err.name === 'NotAllowedError') {
        toast.error("画面共有がキャンセルされました");
      } else {
        toast.error("画面共有を開始できませんでした: " + (err.message || "不明なエラー"));
      }
    }
  };

  const stopScreenShare = async () => {
    try {
      // 画面共有ストリームを停止
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      // 元のカメラ映像に戻す（VideoProcessorの状態を考慮）
      let nextStream = originalStreamRef.current;
      
      // もしoriginalStreamRefがなければ再取得
      if (!nextStream || nextStream.active === false) {
         nextStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
         originalStreamRef.current = nextStream;
      }

      // VideoProcessorのエフェクトが有効なら再適用
      if (videoProcessorRef.current && videoProcessorRef.current.getEffect() !== 'none') {
         nextStream = await videoProcessorRef.current.start(nextStream);
      }

      // P2P接続のトラックをカメラ映像（または加工済み映像）に戻す
      const videoTrack = nextStream.getVideoTracks()[0];
      peersRef.current.forEach(({ peer }) => {
        // @ts-ignore
        if (peer.replaceTrack && localStream) {
          const oldTrack = localStream.getVideoTracks()[0];
          if (oldTrack) {
            // @ts-ignore
            peer.replaceTrack(oldTrack, videoTrack, localStream);
          }
        }
      });

      setLocalStream(nextStream);
      userStreamRef.current = nextStream;
      setIsScreenSharing(false);

      if (socket) {
        socket.emit('screen-share-state', false);
      }

    } catch (err) {
      console.error("Failed to stop screen share:", err);
      toast.error("カメラ映像への復帰に失敗しました");
    }
  };
  const setBackgroundImage = (url: string) => {
    if (!socket || status !== 'joined') return;
    socket.emit('change-background', url);
  };

  const updateScreenShareSize = (width: number, height: number) => {
    if (!socket || status !== 'joined') return;
    socket.emit('screen-share-size', { width, height });
  };
  const sendReaction = (emoji: string) => {};
  
  const setAudioDevice = async (deviceId: string) => {
    try {
      setSelectedAudioDevice(deviceId);
      
      // 新しいオーディオデバイスでストリームを再取得
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true
      });
      
      // 古いストリームを停止
      if (originalStreamRef.current) {
        originalStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      originalStreamRef.current = stream;
      
      // VideoProcessorのエフェクトが有効なら再適用
      if (videoProcessorRef.current && videoProcessorRef.current.getEffect() !== 'none') {
        const processedStream = await videoProcessorRef.current.start(stream);
        setLocalStream(processedStream);
        userStreamRef.current = processedStream;
      } else {
        setLocalStream(stream);
        userStreamRef.current = stream;
      }
      
      // ピア接続のストリームを更新
      peersRef.current.forEach(({ peer }) => {
        if (userStreamRef.current && peer.streams && peer.streams[0]) {
          const oldAudioTrack = peer.streams[0].getAudioTracks()[0];
          const newAudioTrack = userStreamRef.current.getAudioTracks()[0];
          if (oldAudioTrack && newAudioTrack) {
            try {
              peer.replaceTrack(oldAudioTrack, newAudioTrack, peer.streams[0]);
            } catch (replaceErr) {
              console.warn('[Media] Failed to replace audio track for peer:', replaceErr);
            }
          }
        }
      });
      
      console.log('[Media] Audio device changed:', deviceId);
    } catch (err) {
      console.error('[Media] Failed to change audio device:', err);
    }
  };
  
  const setVideoDevice = async (deviceId: string) => {
    try {
      setSelectedVideoDevice(deviceId);
      
      // 新しいビデオデバイスでストリームを再取得
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true,
        video: { deviceId: { exact: deviceId } }
      });
      
      // 古いストリームを停止
      if (originalStreamRef.current) {
        originalStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      originalStreamRef.current = stream;
      
      // VideoProcessorのエフェクトが有効なら再適用
      if (videoProcessorRef.current && videoProcessorRef.current.getEffect() !== 'none') {
        const processedStream = await videoProcessorRef.current.start(stream);
        setLocalStream(processedStream);
        userStreamRef.current = processedStream;
      } else {
        setLocalStream(stream);
        userStreamRef.current = stream;
      }
      
      // ピア接続のストリームを更新
      peersRef.current.forEach(({ peer }) => {
        if (userStreamRef.current && peer.streams && peer.streams[0]) {
          const oldVideoTrack = peer.streams[0].getVideoTracks()[0];
          const newVideoTrack = userStreamRef.current.getVideoTracks()[0];
          if (oldVideoTrack && newVideoTrack) {
            try {
              peer.replaceTrack(oldVideoTrack, newVideoTrack, peer.streams[0]);
            } catch (replaceErr) {
              console.warn('[Media] Failed to replace video track for peer:', replaceErr);
            }
          }
        }
      });
      
      console.log('[Media] Video device changed:', deviceId);
    } catch (err) {
      console.error('[Media] Failed to change video device:', err);
    }
  };

  const setVideoEffect = async (effect: VideoEffect) => {
    if (!videoProcessorRef.current || !originalStreamRef.current) return;

    videoProcessorRef.current.setEffect(effect);

    if (effect === 'none') {
      videoProcessorRef.current.stop();
      // 元のストリームに戻す
      const stream = originalStreamRef.current;
      setLocalStream(stream);
      userStreamRef.current = stream;
      
      // Peer接続のトラック更新
      const videoTrack = stream.getVideoTracks()[0];
      peersRef.current.forEach(({ peer }) => {
        // @ts-ignore
        if (peer.replaceTrack && localStream) {
          const oldTrack = localStream.getVideoTracks()[0];
          if (oldTrack) {
            // @ts-ignore
            peer.replaceTrack(oldTrack, videoTrack, localStream);
          }
        }
      });
    } else {
      // 加工ストリームを開始
      const processedStream = await videoProcessorRef.current.start(originalStreamRef.current);
      setLocalStream(processedStream);
      userStreamRef.current = processedStream;

      // Peer接続のトラック更新
      const videoTrack = processedStream.getVideoTracks()[0];
      peersRef.current.forEach(({ peer }) => {
        // @ts-ignore
        if (peer.replaceTrack && localStream) {
          const oldTrack = localStream.getVideoTracks()[0];
          if (oldTrack) {
            // @ts-ignore
            peer.replaceTrack(oldTrack, videoTrack, localStream);
          }
        }
      });
    }
  };

  const setVideoEffectImage = (url: string) => {
    if (videoProcessorRef.current) {
      videoProcessorRef.current.setBackgroundImage(url);
    }
  };

  return (
    <SocketContext.Provider value={{
      socket, status, users, currentUser, messages, roomId,
      joinRoom, moveUser, sendMessage,
      localStream, toggleAudio, toggleVideo,
      startScreenShare, stopScreenShare, updateScreenShareSize,
      setBackgroundImage, backgroundImage,
      sendReaction, reactions,
      isAudioEnabled, isVideoEnabled, isScreenSharing,
      setAvatar,
      audioDevices, videoDevices,
      selectedAudioDevice, selectedVideoDevice,
      setAudioDevice, setVideoDevice,
      setVideoEffect, setVideoEffectImage
    }}>
      {children}
    </SocketContext.Provider>
  );
};
