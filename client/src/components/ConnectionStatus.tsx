import React from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
  const { status, roomId, users } = useSocket();

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'bg-yellow-500';
      case 'joined': return 'bg-green-500';
      case 'disconnected': return 'bg-red-500';
      case 'connecting': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return 'サーバー接続済み (入室待機)';
      case 'joined': return `入室中 (${users.length + 1}人)`;
      case 'disconnected': return '切断';
      case 'connecting': return '接続中...';
      default: return '不明';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'joined':
      case 'connected': return <Wifi className="w-3 h-3 mr-1" />;
      case 'connecting': return <Loader2 className="w-3 h-3 mr-1 animate-spin" />;
      default: return <WifiOff className="w-3 h-3 mr-1" />;
    }
  };

  return (
    <div className="fixed top-2 right-2 z-50 flex flex-col gap-1 items-end pointer-events-none">
      <Badge className={`${getStatusColor()} text-white shadow-lg transition-all duration-300`}>
        {getIcon()}
        {getStatusText()}
      </Badge>
      {roomId && (
        <Badge variant="outline" className="bg-black/50 text-white border-white/20 text-[10px]">
          Room: {roomId}
        </Badge>
      )}
    </div>
  );
};
