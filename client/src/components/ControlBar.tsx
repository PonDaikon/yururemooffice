import React from 'react';
import { Mic, MicOff, Video, VideoOff, Settings, LogOut, Monitor, MonitorOff, Image as ImageIcon, Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ControlBarProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onSetBackground: () => void;
  onSendReaction: (emoji: string) => void;
  onLeave: () => void;
  onSettings?: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onSetBackground,
  onSendReaction,
  onLeave,
  onSettings
}) => {
  const emojis = ['👍', '👏', '❤️', '😂', '😮', '🎉'];
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 p-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isAudioEnabled ? "ghost" : "destructive"}
              size="icon"
              onClick={onToggleAudio}
              className="rounded-full h-12 w-12 hover:bg-white/20 text-white"
            >
              {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isAudioEnabled ? 'マイクをミュート' : 'マイクをオンにする'}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isVideoEnabled ? "ghost" : "destructive"}
              size="icon"
              onClick={onToggleVideo}
              className="rounded-full h-12 w-12 hover:bg-white/20 text-white"
            >
              {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isVideoEnabled ? 'カメラをオフ' : 'カメラをオン'}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isScreenSharing ? "default" : "ghost"}
              size="icon"
              onClick={onToggleScreenShare}
              className={cn(
                "rounded-full h-12 w-12 hover:bg-white/20 text-white",
                isScreenSharing && "bg-blue-500 hover:bg-blue-600"
              )}
            >
              {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isScreenSharing ? '共有を停止' : '画面を共有'}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onSetBackground}
              className="rounded-full h-12 w-12 hover:bg-white/20 text-white"
            >
              <ImageIcon className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>背景を設定</p>
          </TooltipContent>
        </Tooltip>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-12 w-12 hover:bg-white/20 text-white"
            >
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 bg-black/80 border-white/20 backdrop-blur-xl" side="top">
            <div className="flex gap-2">
              {emojis.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => onSendReaction(emoji)}
                  className="text-2xl hover:scale-125 transition-transform p-1"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-8 bg-white/20 mx-1" />

        {onSettings && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onSettings}
                className="rounded-full h-12 w-12 hover:bg-white/20 text-white"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>設定</p>
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              onClick={onLeave}
              className="rounded-full h-12 w-12 bg-red-500/80 hover:bg-red-600 text-white"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>退出する</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
