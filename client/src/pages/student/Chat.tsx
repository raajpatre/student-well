import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { apiCall } from '../../lib/api';
import { Send, Plus, AlertTriangle, Share2, ChevronLeft, Bot } from 'lucide-react';

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
    <div className="banner banner-warning" style={{ margin: '12px 0', display: 'flex', gap: 12 }}>
      <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {level === 3 && <strong style={{ display: 'block', marginBottom: 4 }}>You're not alone. Please reach out right now:</strong>}
        {level === 2 && <strong style={{ display: 'block', marginBottom: 4 }}>Helplines are available if you need someone to talk to:</strong>}
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
      // find session escalation
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
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>AI Support Chat</h1>
            <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Private and confidential</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={startNewSession} style={{ gap: 6 }}>
            <Plus size={16} /> New Chat
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="empty-state">
            <Bot size={40} />
            <p style={{ fontWeight: 500 }}>No conversations yet</p>
            <p style={{ fontSize: 13 }}>Start a new chat to talk with your AI counsellor.</p>
            <button className="btn btn-primary" onClick={startNewSession}>Start a Chat</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className="card"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  padding: '14px 16px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>
                    {new Date(s.started_at).toLocaleDateString('en-IN', {
                      weekday: 'short', month: 'short', day: 'numeric'
                    })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {new Date(s.started_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {s.student_shared && <span style={{ marginLeft: 8, color: 'var(--good)' }}>• Shared</span>}
                  </div>
                </div>
                {s.escalation_level && (
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: s.escalation_level >= 2 ? 'var(--warning)' : 'var(--attention)',
                    flexShrink: 0
                  }} title="Sensitive session" />
                )}
                <ChevronLeft size={16} style={{ color: 'var(--text-3)', transform: 'rotate(180deg)' }} />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Chat view
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100svh - 140px)' }}>
      {/* Chat header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowSessions(true)}
          style={{ padding: 8, borderRadius: '50%' }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>AI Counsellor</div>
          <div style={{ fontSize: 12, color: 'var(--good)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good)', display: 'inline-block' }} />
            Private & confidential
          </div>
        </div>
        {activeSessionId && !isCurrentShared && messages.length > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleShare}
            disabled={isSharing}
            title="Share summary with counsellor"
            style={{ fontSize: 12, gap: 4 }}
          >
            <Share2 size={14} /> {isSharing ? 'Sharing...' : 'Share'}
          </button>
        )}
        {isCurrentShared && (
          <span style={{ fontSize: 12, color: 'var(--good)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Share2 size={12} /> Shared
          </span>
        )}
      </div>

      {/* Crisis card */}
      {escalationLevel && escalationLevel >= 2 && (
        <CrisisCard level={escalationLevel as 2 | 3} />
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
        {messages.length === 0 && !isLoadingMessages && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>💙</div>
            <p style={{ fontSize: 15, lineHeight: 1.6 }}>
              Hi, I'm here to listen. What's been on your mind lately?
            </p>
          </div>
        )}

        {isLoadingMessages && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 52, borderRadius: 18, width: i % 2 === 0 ? '65%' : '75%', alignSelf: i % 2 === 0 ? 'flex-end' : 'flex-start' }} />
            ))}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
          >
            <div className={`chat-bubble chat-bubble-${msg.role === 'user' ? 'user' : 'ai'}`}>
              {msg.content}
            </div>
          </div>
        ))}

        {isSending && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4, padding: '12px 16px', background: 'var(--surface-raised)', borderRadius: 18 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: '50%', background: 'var(--text-3)',
                  animation: 'pulse-anim 1.2s infinite', animationDelay: `${i * 0.2}s`
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="How are you feeling today?"
          style={{ flex: 1, borderRadius: 24, padding: '11px 18px', fontSize: 14 }}
        />
        <button
          className="btn btn-primary"
          onClick={sendMessage}
          disabled={!input.trim() || isSending}
          style={{ borderRadius: '50%', width: 46, height: 46, padding: 0, flexShrink: 0 }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};
