import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { apiCall } from '../../lib/api';

interface Session {
  id: string;
  started_at: string;
  ended_at: string | null;
  escalation_level: number | null;
  student_shared: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sent_at: string;
}

function CrisisCard({ level }: { level: 2 | 3 }) {
  return (
    <div className="bg-error-container/30 border border-tertiary/30 rounded-2xl p-4 mx-0 my-3 flex gap-3">
      <span className="material-symbols-outlined text-tertiary text-[18px] mt-0.5 shrink-0">warning</span>
      <div className="text-[13px] leading-relaxed text-on-tertiary-container">
        {level === 3 && <strong className="block mb-1">You're not alone. Please reach out right now:</strong>}
        {level === 2 && <strong className="block mb-1">Helplines are available if you need someone to talk to:</strong>}
        <div>📞 <strong>iCall:</strong> 9152987821</div>
        <div>📞 <strong>Vandrevala Foundation:</strong> 1860-2662-345</div>
      </div>
    </div>
  );
}

export const ChatPage: React.FC = () => {
  const { data: sessionsData, refetch: refetchSessions } = useApi<{ sessions: Session[] }>('/api/chat/sessions');
  const sessions = sessionsData?.sessions || [];

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [escalationLevel, setEscalationLevel] = useState<number | null>(null);
  const [showSessions, setShowSessions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [sharedSessions, setSharedSessions] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSession = useCallback(async (sessionId: string) => {
    setIsLoadingMessages(true);
    setActiveSessionId(sessionId);
    setShowSessions(false);
    setEscalationLevel(null);
    try {
      const res = await apiCall<{ messages: Message[] }>(`/api/chat/sessions/${sessionId}/messages`);
      setMessages(res.messages || []);
      const session = sessions.find(s => s.id === sessionId);
      setEscalationLevel(session?.escalation_level || null);
    } catch {
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [sessions]);

  const startNewSession = () => {
    setActiveSessionId(null);
    setMessages([]);
    setEscalationLevel(null);
    setShowSessions(false);
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    setInput('');
    setIsSending(true);

    const tempUserMsg: Message = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: trimmed,
      sent_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await apiCall<{ session_id: string; message: string; escalation_level: number | null }>(
        '/api/chat/message',
        { method: 'POST', body: { session_id: activeSessionId, message: trimmed } }
      );

      if (!activeSessionId) {
        setActiveSessionId(res.session_id);
        refetchSessions();
      }

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.message,
        sent_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      if (res.escalation_level) {
        setEscalationLevel(res.escalation_level);
      }
    } catch (err: any) {
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: err.message || "I'm having a moment — please try again.",
        sent_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleShare = async () => {
    if (!activeSessionId || isSharing) return;
    setIsSharing(true);
    try {
      await apiCall(`/api/chat/sessions/${activeSessionId}/share`, { method: 'POST' });
      setSharedSessions((prev) => new Set([...prev, activeSessionId]));
      refetchSessions();
    } catch {}
    setIsSharing(false);
  };

  const isCurrentShared = activeSessionId
    ? (sessions.find(s => s.id === activeSessionId)?.student_shared || sharedSessions.has(activeSessionId))
    : false;

  // Session list view
  if (showSessions) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-headline-md text-on-surface mb-1">AI Support Chat</h1>
            <p className="text-[13px] text-outline">Private and confidential</p>
          </div>
          <button
            className="flex items-center gap-2 h-[40px] px-4 bg-primary-container text-on-primary rounded-btn font-body-sm text-[13px] hover:bg-primary transition-colors shadow-sm"
            onClick={startNewSession}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Chat
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-primary-container text-[32px]">chat_bubble</span>
            </div>
            <p className="font-medium text-on-surface">No conversations yet</p>
            <p className="text-[13px] text-outline">Start a new chat to talk with your AI counsellor.</p>
            <button
              className="h-[48px] px-8 bg-primary-container text-on-primary rounded-btn font-body-md hover:bg-primary transition-colors shadow-sm"
              onClick={startNewSession}
            >
              Start a Chat
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className="bg-surface-container-lowest rounded-2xl p-4 shadow-warm flex items-center gap-3 cursor-pointer text-left w-full hover:bg-surface-container-low transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary-container text-[18px]">chat_bubble</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-on-surface mb-0.5">
                    {new Date(s.started_at).toLocaleDateString('en-IN', {
                      weekday: 'short', month: 'short', day: 'numeric'
                    })}
                  </div>
                  <div className="text-[12px] text-outline flex items-center gap-2">
                    {new Date(s.started_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {s.student_shared && <span className="text-primary-container">• Shared</span>}
                  </div>
                </div>
                {s.escalation_level && (
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${s.escalation_level >= 2 ? 'bg-tertiary' : 'bg-secondary-container'}`}
                    title="Sensitive session"
                  />
                )}
                <span className="material-symbols-outlined text-outline text-[18px]">chevron_right</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Chat view
  return (
    <div className="flex flex-col" style={{ height: 'calc(100svh - 140px)' }}>
      {/* Chat header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-outline-variant/30">
        <button
          className="text-on-surface-variant hover:opacity-80 transition-opacity p-1"
          onClick={() => setShowSessions(true)}
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[12px] font-medium">
              SW
            </div>
            <div>
              <div className="text-[15px] font-medium text-on-surface leading-tight">AI Counsellor</div>
              <div className="text-[12px] text-outline flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px] text-primary">lock</span>
                Private &amp; confidential
              </div>
            </div>
          </div>
        </div>
        {activeSessionId && !isCurrentShared && messages.length > 0 && (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 border border-outline-variant/50 rounded-xl text-tertiary text-[13px] font-medium hover:bg-surface-container-low transition-colors"
            onClick={handleShare}
            disabled={isSharing}
          >
            <span className="material-symbols-outlined text-[16px]">share</span>
            {isSharing ? 'Sharing...' : 'Share'}
          </button>
        )}
        {isCurrentShared && (
          <span className="text-[12px] text-primary-container flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">check_circle</span> Shared
          </span>
        )}
      </div>

      {/* Sub-header: privacy note */}
      <div className="bg-primary-fixed/30 py-2 px-4 rounded-xl text-center mb-3">
        <p className="text-[10px] uppercase tracking-wider text-primary font-medium">
          This conversation is private · You control what gets shared
        </p>
      </div>

      {/* Crisis card */}
      {escalationLevel !== null && escalationLevel >= 2 && (
        <CrisisCard level={escalationLevel as 2 | 3} />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-6 pb-4 no-scrollbar">
        {messages.length === 0 && !isLoadingMessages && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 text-[12px] font-medium">
              SW
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[80%]">
              <p className="text-[15px] text-on-surface leading-relaxed">
                Hey, good to see you. How are things feeling this week?
              </p>
            </div>
          </div>
        )}

        {isLoadingMessages && (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-14 rounded-2xl bg-surface-container-highest animate-pulse ${i % 2 === 0 ? 'self-end w-2/3' : 'w-3/4'}`} />
            ))}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 text-[12px] font-medium">
                SW
              </div>
            )}
            <div
              className={`px-4 py-3 max-w-[80%] text-[15px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary-container text-on-primary-container rounded-2xl rounded-br-sm shadow-warm'
                  : 'bg-surface-container-lowest border border-outline-variant/50 rounded-2xl rounded-bl-sm text-on-surface shadow-warm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 text-[12px] font-medium">
              SW
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-outline animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Share with counsellor (shown in chat when session active) */}
      {activeSessionId && !isCurrentShared && messages.length > 2 && (
        <div className="flex justify-center my-2">
          <button
            className="flex items-center gap-2 px-4 py-2 border border-outline-variant/50 rounded-xl text-tertiary text-[14px] font-medium hover:bg-surface-container-low transition-colors"
            onClick={handleShare}
            disabled={isSharing}
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
            Share with counsellor
          </button>
        </div>
      )}

      {/* Input */}
      <div className="pt-3 border-t border-outline-variant/30">
        <div className="flex items-center bg-surface-container-lowest border border-outline-variant/50 rounded-btn p-2 focus-within:border-primary transition-colors gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Type your message..."
            className="flex-1 bg-transparent border-none outline-none text-[15px] text-on-surface placeholder:text-outline/50 px-2"
          />
          <button
            className="w-10 h-10 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center hover:opacity-90 transition-opacity shrink-0 disabled:opacity-40"
            onClick={sendMessage}
            disabled={!input.trim() || isSending}
          >
            <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
