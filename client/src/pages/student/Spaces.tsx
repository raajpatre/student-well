import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { apiCall } from '../../lib/api';
import { Users, ToggleLeft, ToggleRight, Flag, Plus, X } from 'lucide-react';

interface Space {
  id: string;
  name: string;
  description: string;
  tags: string[];
  member_count: number;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  author_name: string;
}

export const SpacesPage: React.FC = () => {
  const { data: spacesData, isLoading } = useApi<{ spaces: Space[] }>('/api/spaces');
  const spaces = spacesData?.spaces || [];

  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [studyToggle, setStudyToggle] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [flaggedPosts, setFlaggedPosts] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const openSpace = async (space: Space) => {
    setActiveSpace(space);
    setLoadingPosts(true);
    try {
      const res = await apiCall<{ posts: Post[] }>(`/api/spaces/${space.id}/posts`);
      setPosts(res.posts || []);
    } catch { setPosts([]); }
    setLoadingPosts(false);
  };

  const submitPost = async () => {
    if (!newPost.trim() || !activeSpace || isPosting) return;
    setIsPosting(true);
    try {
      const res = await apiCall<{ post: Post }>(`/api/spaces/${activeSpace.id}/posts`, {
        method: 'POST', body: { content: newPost.slice(0, 500) }
      });
      setPosts((prev) => [res.post, ...prev]);
      setNewPost('');
    } catch {}
    setIsPosting(false);
  };

  const flagPost = async (postId: string) => {
    if (!activeSpace) return;
    setMenuOpen(null);
    try {
      await apiCall(`/api/spaces/${activeSpace.id}/posts/${postId}/flag`, { method: 'POST' });
      setFlaggedPosts((prev) => new Set([...prev, postId]));
    } catch {}
  };

  if (activeSpace) {
    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setActiveSpace(null)}
            style={{ padding: 8, borderRadius: '50%' }}>
            <X size={20} />
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>{activeSpace.name}</h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {activeSpace.tags.map((t) => (
                <span key={t} className="badge badge-accent" style={{ fontSize: 11 }}>{t}</span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setStudyToggle((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: studyToggle ? 'var(--good)' : 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}
          >
            {studyToggle ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
            Study Together
          </button>
        </div>

        {/* Post input */}
        <div className="card" style={{ padding: '12px 14px' }}>
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value.slice(0, 500))}
            placeholder="Share something with the space..."
            rows={2}
            style={{ width: '100%', resize: 'none', border: 'none', background: 'transparent', fontSize: 14, outline: 'none' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{newPost.length}/500</span>
            <button className="btn btn-primary btn-sm" onClick={submitPost} disabled={!newPost.trim() || isPosting}>
              <Plus size={14} /> Post
            </button>
          </div>
        </div>

        {/* Posts */}
        {loadingPosts ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-md)' }} />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <Users size={36} />
            <p>No posts yet. Be the first to share something!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {posts.map((post) => (
              <div key={post.id} className="card" style={{ padding: '14px 16px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{post.author_name || 'Anonymous'}</span>
                  <div style={{ position: 'relative' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setMenuOpen(menuOpen === post.id ? null : post.id)}
                      style={{ padding: '4px 8px', fontSize: 18, lineHeight: 1 }}
                    >⋯</button>
                    {menuOpen === post.id && (
                      <div style={{
                        position: 'absolute', right: 0, top: 28, background: 'var(--surface-raised)',
                        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        padding: 4, zIndex: 10, minWidth: 130
                      }}>
                        <button
                          onClick={() => flagPost(post.id)}
                          disabled={flaggedPosts.has(post.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                            background: 'none', border: 'none', color: flaggedPosts.has(post.id) ? 'var(--text-muted)' : 'var(--warning)',
                            fontSize: 13, cursor: 'pointer', width: '100%', borderRadius: 4
                          }}
                        >
                          <Flag size={13} /> {flaggedPosts.has(post.id) ? 'Flagged' : 'Flag post'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>{post.content}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  {new Date(post.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Social Spaces</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Connect with people who get it</p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : spaces.length === 0 ? (
        <div className="empty-state">
          <Users size={36} />
          <p>No spaces available yet.</p>
          <p style={{ fontSize: 13 }}>Check back soon — your institution is setting things up.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {spaces.map((space) => (
            <button
              key={space.id}
              className="card"
              onClick={() => openSpace(space)}
              style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>{space.name}</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={12} /> {space.member_count}
                </span>
              </div>
              {space.description && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                  {space.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {space.tags?.map((t) => (
                  <span key={t} className="badge badge-neutral" style={{ fontSize: 11 }}>{t}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
