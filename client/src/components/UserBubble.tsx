import React, { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getZoneForPosition } from '@/lib/constants';
import { ResizableBox, ResizeCallbackData } from 'react-resizable';
import 'react-resizable/css/styles.css';

interface UserBubbleProps {
  id: string;
  name: string;
  stream?: MediaStream;
  position: { x: number; y: number };
  currentUserPosition?: { x: number; y: number };
  isCurrentUser?: boolean;
  onMove?: (position: { x: number; y: number }) => void;
  avatar?: string;
  isScreenSharing?: boolean;
  screenShareSize?: { width: number; height: number };
  onScreenShareResize?: (width: number, height: number) => void;
}

export const UserBubble: React.FC<UserBubbleProps> = ({
  id,
  name,
  stream,
  position,
  currentUserPosition,
  isCurrentUser = false,
  onMove,
  avatar = "default",
  isScreenSharing = false,
  screenShareSize: propScreenShareSize,
  onScreenShareResize
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const nodeRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [localScreenShareSize, setLocalScreenShareSize] = useState({ width: 480, height: 360 });

  // Sync local size with prop size if provided (for receiver)
  useEffect(() => {
    if (propScreenShareSize) {
      setLocalScreenShareSize(propScreenShareSize);
    }
  }, [propScreenShareSize]);

  // Check if stream has active video track
  useEffect(() => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      setIsVideoActive(!!videoTrack && videoTrack.enabled);

      const handleTrackEnded = () => setIsVideoActive(false);
      const handleTrackMute = () => setIsVideoActive(false);
      const handleTrackUnmute = () => setIsVideoActive(true);

      if (videoTrack) {
        videoTrack.addEventListener('ended', handleTrackEnded);
        videoTrack.addEventListener('mute', handleTrackMute);
        videoTrack.addEventListener('unmute', handleTrackUnmute);
      }

      return () => {
        if (videoTrack) {
          videoTrack.removeEventListener('ended', handleTrackEnded);
          videoTrack.removeEventListener('mute', handleTrackMute);
          videoTrack.removeEventListener('unmute', handleTrackUnmute);
        }
      };
    } else {
      setIsVideoActive(false);
    }
  }, [stream]);

  const handleVideoMetadata = () => {
    // No longer needed for screen share detection as we use explicit prop
  };

  // Audio analysis for active speaker detection
  useEffect(() => {
    if (!stream || !isAudioEnabled(stream)) {
      setIsSpeaking(false);
      return;
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    const javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;

    microphone.connect(analyser);
    analyser.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);

    javascriptNode.onaudioprocess = () => {
      const array = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(array);
      let values = 0;
      const length = array.length;
      for (let i = 0; i < length; i++) {
        values += array[i];
      }
      const average = values / length;
      setIsSpeaking(average > 10); // Threshold for speaking
    };

    return () => {
      javascriptNode.disconnect();
      analyser.disconnect();
      microphone.disconnect();
      audioContext.close();
    };
  }, [stream]);

  const isAudioEnabled = (stream: MediaStream) => {
    return stream.getAudioTracks().some(track => track.enabled);
  };

  // Audio distance attenuation logic
  useEffect(() => {
    if (isCurrentUser || !videoRef.current || !currentUserPosition) return;

    const calculateVolume = () => {
      const myZone = getZoneForPosition(currentUserPosition.x, currentUserPosition.y);
      const targetZone = getZoneForPosition(position.x, position.y);

      // プライベートゾーン（会議室）のロジック
      if (myZone || targetZone) {
        // どちらかがゾーンにいる場合
        if (myZone !== targetZone) {
          // 異なるゾーン（片方が外、または別の部屋）なら完全に遮断
          if (videoRef.current) videoRef.current.volume = 0;
          return;
        }
        // 同じゾーンにいるなら、距離に関係なくクリアに聞こえる（音量100%）
        if (myZone === targetZone) {
          if (videoRef.current) videoRef.current.volume = 1;
          return;
        }
      }

      const dx = position.x - currentUserPosition.x;
      const dy = position.y - currentUserPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const minDistance = 100; // この距離までは音量100%
      const maxDistance = 600; // この距離で音量0%

      let volume = 0;
      if (distance <= minDistance) {
        volume = 1;
      } else if (distance >= maxDistance) {
        volume = 0;
      } else {
        // 線形減衰ではなく、二乗減衰（より自然な聞こえ方）
        const normalizedDist = (distance - minDistance) / (maxDistance - minDistance);
        volume = 1 - (normalizedDist * normalizedDist);
      }

      if (videoRef.current) {
        videoRef.current.volume = volume;
      }
    };

    calculateVolume();
  }, [position, currentUserPosition, isCurrentUser]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleStop = (e: any, data: { x: number; y: number }) => {
    if (onMove) {
      onMove({ x: data.x, y: data.y });
    }
  };

  // Constants for size to ensure consistency
  const BUBBLE_SIZE_CLASS = "w-24 h-24"; // Slightly larger size (approx 96px)
  const INNER_SIZE_CLASS = "w-20 h-20";  // Inner circle size (approx 80px)

  const renderContent = () => (
    <>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          "relative overflow-hidden border-2 shadow-lg backdrop-blur-md bg-white/10 transition-all duration-300",
          isScreenSharing ? "w-full h-full rounded-xl flex items-center justify-center bg-black" : `${INNER_SIZE_CLASS} rounded-full flex items-center justify-center`,
          isSpeaking ? "border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.5)]" : "border-white/20"
        )}
      >
        {/* Video Element - Always present but hidden if not active/screen sharing */}
        {stream && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isCurrentUser}
            onLoadedMetadata={handleVideoMetadata}
            className={cn(
              "absolute inset-0 w-full h-full",
              isScreenSharing ? "object-contain bg-black/50" : "object-cover",
              // 画面共有時は常に表示、それ以外はカメラがオンの時のみ表示
              !isScreenSharing && !isVideoActive && "hidden"
            )}
          />
        )}

        {/* Avatar Element - Shown when video is NOT active or NOT screen sharing */}
        {/* Avatar Element - Shown when video is NOT active AND NOT screen sharing */}
        {(!isVideoActive && !isScreenSharing) && (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-400 to-pink-400 text-white font-bold text-lg z-10">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </motion.div>
      
      <div className="mt-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-medium shadow-sm whitespace-nowrap max-w-[120px] overflow-hidden text-ellipsis">
        {name} {isCurrentUser && "(You)"}
      </div>
    </>
  );

  return (
    <Draggable
      nodeRef={nodeRef}
      position={isCurrentUser ? undefined : position}
      defaultPosition={isCurrentUser ? position : undefined}
      onStop={isCurrentUser ? handleStop : undefined}
      disabled={!isCurrentUser}
      bounds="parent"
      cancel=".react-resizable-handle" // Prevent dragging when resizing
    >
      <div 
        ref={nodeRef}
        className={cn(
          "absolute flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-all duration-300",
          isScreenSharing ? "" : BUBBLE_SIZE_CLASS,
          // 画面共有時は他の要素より前面に表示、自分自身はさらに前面
          isScreenSharing ? (isCurrentUser ? "z-40" : "z-30") : (isCurrentUser ? "z-20" : "z-10")
        )}
        style={!isCurrentUser ? { transform: `translate(${position.x}px, ${position.y}px)` } : undefined}
      >
        {isScreenSharing ? (
          isCurrentUser ? (
            // 送信側：リサイズ可能で、変更をサーバーに通知
            <ResizableBox
              width={localScreenShareSize.width}
              height={localScreenShareSize.height}
              minConstraints={[200, 150]}
              maxConstraints={[1200, 900]}
              onResize={(e: React.SyntheticEvent, { size }: ResizeCallbackData) => {
                setLocalScreenShareSize({ width: size.width, height: size.height });
              }}
              onResizeStop={(e: React.SyntheticEvent, { size }: ResizeCallbackData) => {
                if (onScreenShareResize) {
                  onScreenShareResize(size.width, size.height);
                }
              }}
              resizeHandles={['se']}
              className="relative group"
              handle={
                <div className="react-resizable-handle react-resizable-handle-se absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-50 bg-white/20 hover:bg-white/40 rounded-tl-lg transition-colors" />
              }
            >
              <div className="w-full h-full flex flex-col items-center">
                {renderContent()}
              </div>
            </ResizableBox>
          ) : (
            // 受信側：送信側のサイズに同期（リサイズ不可）
            <div 
              style={{ 
                width: localScreenShareSize.width, 
                height: localScreenShareSize.height,
                transition: 'width 0.3s, height 0.3s' // スムーズなアニメーション
              }} 
              className="relative"
            >
              <div className="w-full h-full flex flex-col items-center">
                {renderContent()}
              </div>
            </div>
          )
        ) : (
          renderContent()
        )}
      </div>
    </Draggable>
  );
};
