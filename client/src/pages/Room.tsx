import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { SocketProvider, useSocket } from '@/contexts/SocketContext';
import { UserBubble } from '@/components/UserBubble';
import { ChatBox } from '@/components/ChatBox';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { ControlBar } from '@/components/ControlBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PRIVATE_ZONES, getZoneForPosition } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';

const RoomContent: React.FC = () => {
  const { 
    users, 
    currentUser, 
    joinRoom, 
    moveUser, 
    messages, 
    sendMessage,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    updateScreenShareSize,
    setBackgroundImage,
    backgroundImage,
    sendReaction,
    reactions,
    localStream
  } = useSocket();
  
  const [hasJoined, setHasJoined] = useState(false);
  const [name, setName] = useState(() => localStorage.getItem("spatial-chat-username") || "");
  const [location, setLocation] = useLocation();
  
  // Extract room ID from URL query parameter or default to "main-hall"
  const getRoomIdFromUrl = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const roomFromUrl = searchParams.get('room');
    console.log("Room ID from URL:", roomFromUrl);
    return roomFromUrl || "main-hall";
  };

  const [roomId, setRoomId] = useState(getRoomIdFromUrl);

  // Ensure roomId is updated if URL changes (e.g. back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const newRoomId = getRoomIdFromUrl();
      setRoomId(newRoomId);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [currentZone, setCurrentZone] = useState<{ id: string; name: string } | null>(null);
  const previewVideoRef = React.useRef<HTMLVideoElement>(null);
  const { 
    setAvatar, 
    audioDevices, 
    videoDevices, 
    selectedAudioDevice, 
    selectedVideoDevice, 
    setAudioDevice, 
    setVideoDevice,
    setVideoEffect,
    setVideoEffectImage
  } = useSocket();

  const [videoEffect, setLocalVideoEffect] = useState<'none' | 'blur' | 'image'>('none');

  const handleVideoEffectChange = (effect: 'none' | 'blur' | 'image') => {
    setLocalVideoEffect(effect);
    setVideoEffect(effect);
  };

  const handleVideoEffectImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setVideoEffectImage(event.target.result as string);
          handleVideoEffectChange('image');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Set page title
  useEffect(() => {
    document.title = "ゆるリモオフィス";
  }, []);

  // Preview stream effect
  useEffect(() => {
    if (!hasJoined && localStream && previewVideoRef.current) {
      previewVideoRef.current.srcObject = localStream;
    }
  }, [hasJoined, localStream]);

  // Update current zone based on position
  useEffect(() => {
    if (currentUser?.position) {
      const zoneId = getZoneForPosition(currentUser.position.x, currentUser.position.y);
      if (zoneId) {
        const zone = PRIVATE_ZONES.find(z => z.id === zoneId);
        setCurrentZone(zone ? { id: zone.id, name: zone.name } : null);
      } else {
        setCurrentZone(null);
      }
    }
  }, [currentUser?.position]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      localStorage.setItem("spatial-chat-username", name);
      setAvatar("default");
      
      // Update URL with room ID if not present
      const searchParams = new URLSearchParams(window.location.search);
      if (!searchParams.get('room')) {
        const newUrl = `${window.location.pathname}?room=${roomId}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
      }
      
      joinRoom(roomId, name);
      setHasJoined(true);
      
      // Play join sound for self
      const audio = new Audio('/sounds/join.wav');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  const handleLeave = () => {
    // Clear room parameter from URL and reload to return to lobby
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
    window.location.reload();
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleSettings = () => {
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      localStorage.setItem("spatial-chat-username", name);
      setAvatar("default");
      // Note: In a real app, we would emit a socket event to update the name for everyone
      // For now, we just close the modal as state is already updated
      setIsSettingsOpen(false);
    }
  };

  const handleSetBackground = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setBackgroundImage(event.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  if (!hasJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
          <div className="absolute top-0 -right-20 w-96 h-96 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-40 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />
        </div>

        <Card className="w-full max-w-md bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl relative z-10">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-white">ゆるリモオフィス</CardTitle>
            <CardDescription className="text-white/60">
              名前を入力してバーチャル空間に参加しましょう
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 relative aspect-video bg-black/50 rounded-xl overflow-hidden border border-white/10 shadow-inner">
              {localStream ? (
                <video
                  ref={previewVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "w-full h-full object-cover transform scale-x-[-1]",
                    !isVideoEnabled && "hidden"
                  )}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/50">
                  カメラを起動中...
                </div>
              )}
              
              {!isVideoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white/50">
                  <div className="flex flex-col items-center gap-2">
                    <VideoOff className="w-12 h-12 opacity-50" />
                    <span>カメラはオフです</span>
                  </div>
                </div>
              )}

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                <Button
                  type="button"
                  variant={isAudioEnabled ? "secondary" : "destructive"}
                  size="icon"
                  className="rounded-full w-12 h-12 shadow-lg"
                  onClick={toggleAudio}
                >
                  {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </Button>
                <Button
                  type="button"
                  variant={isVideoEnabled ? "secondary" : "destructive"}
                  size="icon"
                  className="rounded-full w-12 h-12 shadow-lg"
                  onClick={toggleVideo}
                >
                  {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </Button>
              </div>
            </div>

            <form onSubmit={handleJoin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">表示名</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="名前を入力..."
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 text-lg"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">ルームID (共有用)</label>
                <div className="flex gap-2">
                  <Input
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="ルームIDを入力..."
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-10"
                  />
                  <Button 
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
                      navigator.clipboard.writeText(url);
                      alert("共有リンクをコピーしました！");
                    }}
                    className="whitespace-nowrap"
                  >
                    リンクをコピー
                  </Button>
                </div>
              </div>



              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">マイク設定</label>
                  <select
                    value={selectedAudioDevice}
                    onChange={(e) => setAudioDevice(e.target.value)}
                    className="w-full bg-white/10 border-white/20 text-white rounded-md h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {audioDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId} className="text-black">
                        {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">カメラ設定</label>
                  <select
                    value={selectedVideoDevice}
                    onChange={(e) => setVideoDevice(e.target.value)}
                    className="w-full bg-white/10 border-white/20 text-white rounded-md h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {videoDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId} className="text-black">
                        {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">ビデオ背景エフェクト</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={videoEffect === 'none' ? 'default' : 'secondary'}
                    onClick={() => handleVideoEffectChange('none')}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/10"
                  >
                    なし
                  </Button>
                  <Button
                    type="button"
                    variant={videoEffect === 'blur' ? 'default' : 'secondary'}
                    onClick={() => handleVideoEffectChange('blur')}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/10"
                  >
                    ぼかし
                  </Button>
                  <div className="flex-1 relative">
                    <Button
                      type="button"
                      variant={videoEffect === 'image' ? 'default' : 'secondary'}
                      className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/10"
                      onClick={() => document.getElementById('bg-image-upload-join')?.click()}
                    >
                      画像
                    </Button>
                    <input
                      id="bg-image-upload-join"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleVideoEffectImageUpload}
                    />
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg bg-white text-purple-900 hover:bg-white/90 font-semibold shadow-lg transition-all hover:scale-[1.02]"
                disabled={!name.trim()}
              >
                ルームに参加
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#1a1b26]">
      {/* Background Image or Effects */}
      {backgroundImage ? (
        <div 
          className="absolute inset-0 bg-cover bg-center pointer-events-none transition-all duration-1000 z-0"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      ) : (
        <>
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] animate-pulse delay-1000" />
          </div>
          <div 
            className="absolute inset-0 opacity-20 pointer-events-none z-0"
            style={{
              backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
              backgroundSize: '50px 50px'
            }}
          />
        </>
      )}

      {/* Private Zones */}
      {PRIVATE_ZONES.map(zone => (
        <div
          key={zone.id}
          className={cn(
            "absolute rounded-3xl border-2 border-white/30 backdrop-blur-sm flex items-center justify-center pointer-events-none transition-colors duration-500",
            "bg-gradient-to-br",
            zone.color
          )}
          style={{
            left: zone.x,
            top: zone.y,
            width: zone.width,
            height: zone.height
          }}
        >
          <div className="text-white/50 font-bold text-xl tracking-widest uppercase">
            {zone.name}
          </div>
        </div>
      ))}

      {/* Room Info Overlay */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 text-white shadow-lg">
          <div className="text-xs text-white/60 uppercase tracking-wider font-bold mb-1">Current Room</div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-mono text-lg font-bold">{roomId}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-white/80 border-t border-white/10 pt-2">
            <span className="font-bold">{users.length + (currentUser ? 1 : 0)}</span>
            <span>users online</span>
          </div>
        </div>
        <Button 
          variant="secondary" 
          size="sm"
          className="bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md"
          onClick={() => {
            const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
            navigator.clipboard.writeText(url);
            alert("共有リンクをコピーしました！");
          }}
        >
          リンクをコピー
        </Button>
      </div>

      {/* Users Area */}
      <div className="relative w-full h-full">
        {currentUser && (
          <UserBubble
            id={currentUser.id}
            name={name}
            stream={localStream || undefined}
            position={currentUser.position}
            currentUserPosition={currentUser.position}
            isCurrentUser={true}
            onMove={moveUser}
            avatar={currentUser.avatar}
            isScreenSharing={isScreenSharing}
            onScreenShareResize={updateScreenShareSize}
          />
        )}
        
        {users.map(user => (
          <UserBubble
            key={user.id}
            id={user.id}
            name={user.name || 'Guest'}
            stream={user.stream}
            position={user.position}
            currentUserPosition={currentUser?.position}
            avatar={user.avatar}
            isScreenSharing={user.isScreenSharing}
            screenShareSize={user.screenShareSize}
          />
        ))}
        {/* Play sound when new user joins (detected by users array change) */}
        <UserJoinSoundPlayer users={users} />

        {/* Reactions */}
        {reactions.map(reaction => (
          <div
            key={reaction.id}
            className="absolute text-4xl pointer-events-none animate-bounce z-50"
            style={{
              left: reaction.x + 30,
              top: reaction.y - 50,
              animationDuration: '2s'
            }}
          >
            {reaction.emoji}
          </div>
        ))}
      </div>

      <ControlBar
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        isScreenSharing={isScreenSharing}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={isScreenSharing ? stopScreenShare : startScreenShare}
        onSetBackground={handleSetBackground}
        onSendReaction={sendReaction}
        onLeave={handleLeave}
        onSettings={handleSettings}
      />

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-gray-900/90 border-white/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-white">設定</CardTitle>
              <CardDescription className="text-white/60">
                デバイスとアバターの設定を変更できます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">表示名</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="名前を入力..."
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-10"
                  />
                </div>



                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">マイク設定</label>
                    <select
                      value={selectedAudioDevice}
                      onChange={(e) => setAudioDevice(e.target.value)}
                      className="w-full bg-white/10 border-white/20 text-white rounded-md h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {audioDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId} className="text-black">
                          {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">カメラ設定</label>
                    <select
                      value={selectedVideoDevice}
                      onChange={(e) => setVideoDevice(e.target.value)}
                      className="w-full bg-white/10 border-white/20 text-white rounded-md h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {videoDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId} className="text-black">
                          {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">ビデオ背景エフェクト</label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={videoEffect === 'none' ? 'default' : 'secondary'}
                        onClick={() => handleVideoEffectChange('none')}
                        className="flex-1"
                      >
                        なし
                      </Button>
                      <Button
                        type="button"
                        variant={videoEffect === 'blur' ? 'default' : 'secondary'}
                        onClick={() => handleVideoEffectChange('blur')}
                        className="flex-1"
                      >
                        ぼかし
                      </Button>
                      <div className="flex-1 relative">
                        <Button
                          type="button"
                          variant={videoEffect === 'image' ? 'default' : 'secondary'}
                          className="w-full"
                          onClick={() => document.getElementById('bg-image-upload')?.click()}
                        >
                          画像
                        </Button>
                        <input
                          id="bg-image-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleVideoEffectImageUpload}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="flex-1 text-white hover:bg-white/10"
                    onClick={() => setIsSettingsOpen(false)}
                  >
                    キャンセル
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    保存する
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      
      <div className="relative z-50">
        <ConnectionStatus />
        <ChatBox
          messages={messages}
          onSendMessage={sendMessage}
          currentZoneId={currentZone?.id}
          currentZoneName={currentZone?.name}
        />
      </div>
    </div>
  );
};

export default function Room() {
  return (
    <SocketProvider>
      <RoomContent />
    </SocketProvider>
  );
}

// Helper component to handle join sounds
const UserJoinSoundPlayer: React.FC<{ users: any[] }> = ({ users }) => {
  const prevUsersRef = React.useRef<number>(users.length);

  useEffect(() => {
    if (users.length > prevUsersRef.current) {
      // User joined
      const audio = new Audio('/sounds/join.wav');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Audio play failed:', e));
    }
    prevUsersRef.current = users.length;
  }, [users.length]);

  return null;
};
