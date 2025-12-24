import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Users, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  sender: string;
  message: string;
  timestamp: number;
  zoneId?: string;
}

interface ChatBoxProps {
  messages: Message[];
  onSendMessage: (text: string, zoneId?: string) => void;
  currentZoneId?: string | null;
  currentZoneName?: string | null;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendMessage, currentZoneId, currentZoneName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [activeTab, setActiveTab] = useState<"global" | "zone">("global");
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);
  const [zoneUnreadCount, setZoneUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);

  // Switch to global tab if user leaves zone
  useEffect(() => {
    if (!currentZoneId && activeTab === "zone") {
      setActiveTab("global");
    }
  }, [currentZoneId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, activeTab]);

  // Handle new messages (sound and badge)
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      const lastMessage = messages[messages.length - 1];
      
      // Play sound
      const audio = new Audio('/sounds/message.wav');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Audio play failed:', e));

      if (!isOpen) {
        if (lastMessage.zoneId) {
          setZoneUnreadCount(prev => prev + 1);
        } else {
          setGlobalUnreadCount(prev => prev + 1);
        }
      } else {
        // If open but not on the right tab, increment unread
        if (lastMessage.zoneId && activeTab !== 'zone') {
          setZoneUnreadCount(prev => prev + 1);
        } else if (!lastMessage.zoneId && activeTab !== 'global') {
          setGlobalUnreadCount(prev => prev + 1);
        }
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, isOpen, activeTab]);

  // Reset unread count when tab is active
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'global') {
        setGlobalUnreadCount(0);
      } else {
        setZoneUnreadCount(0);
      }
    }
  }, [isOpen, activeTab]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      if (activeTab === "zone" && currentZoneId) {
        onSendMessage(inputText, currentZoneId);
      } else {
        onSendMessage(inputText);
      }
      setInputText("");
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (activeTab === "global") {
      return !msg.zoneId; // Show only global messages
    } else {
      return msg.zoneId === currentZoneId; // Show only current zone messages
    }
  });

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-80 h-96 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="p-2 border-b border-white/10 bg-white/5">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "global" | "zone")} className="w-full">
              <TabsList className="w-full grid grid-cols-2 bg-black/20">
                <TabsTrigger value="global" className="text-xs relative">
                  <Users className="w-3 h-3 mr-2" />
                  全体
                  {globalUnreadCount > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 rounded-full">
                      {globalUnreadCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="zone" disabled={!currentZoneId} className="text-xs relative">
                  <Lock className="w-3 h-3 mr-2" />
                  {currentZoneName || "エリア"}
                  {zoneUnreadCount > 0 && (
                    <span className="ml-2 bg-purple-500 text-white text-[10px] px-1.5 rounded-full">
                      {zoneUnreadCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <ScrollArea className="flex-1 p-4 h-full">
            <div className="space-y-4 min-h-full">
              {filteredMessages.length === 0 && (
                <div className="text-center text-white/30 text-xs py-10">
                  メッセージ機能は現在実装準備中です！！
                </div>
              )}
              {filteredMessages.map((msg) => (
                <div key={msg.id} className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-bold text-white/80">{msg.sender}</span>
                    <span className="text-[10px] text-white/40">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={cn(
                    "rounded-lg p-2 text-sm break-words",
                    msg.zoneId 
                      ? "bg-purple-500/20 text-purple-100 border border-purple-500/30" 
                      : "bg-white/10 text-white/90"
                  )}>
                    {msg.message}
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <form onSubmit={handleSend} className="p-3 border-t border-white/10 bg-white/5 flex gap-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={activeTab === "zone" ? `${currentZoneName}に送信...` : "全員に送信..."}
              className="bg-white/10 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/20"
            />
            <Button type="submit" size="icon" variant="ghost" className="text-white hover:bg-white/10">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="lg"
        className={cn(
          "rounded-full h-14 w-14 shadow-lg transition-all duration-300 relative",
          isOpen ? "bg-white text-purple-600 hover:bg-white/90" : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90"
        )}
      >
        <MessageSquare className={cn("h-6 w-6 transition-transform", isOpen && "scale-90")} />
        {/* Global Unread Badge (Red) */}
        {globalUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#1a1b26] animate-bounce z-20">
            {globalUnreadCount > 9 ? '9+' : globalUnreadCount}
          </span>
        )}
        {/* Zone Unread Badge (Purple) - Positioned slightly differently if both exist */}
        {zoneUnreadCount > 0 && (
          <span className={cn(
            "absolute bg-purple-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#1a1b26] animate-bounce z-10",
            globalUnreadCount > 0 ? "-top-1 right-3" : "-top-1 -right-1"
          )}>
            {zoneUnreadCount > 9 ? '9+' : zoneUnreadCount}
          </span>
        )}
      </Button>
    </div>
  );
};
