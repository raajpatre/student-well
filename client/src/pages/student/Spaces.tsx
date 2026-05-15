import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { apiCall } from '../../lib/api';

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
      <div className="flex flex-col gap-4 pb-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            className="text-on-surface-variant hover:opacity-80 transition-opacity"
            onClick={() => setActiveSpace(null)}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-medium text-on-surface truncate">{activeSpace.name}</h2>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {activeSpace.tags.map((t) => (
                <span key={t} className="bg-primary-fixed text-on-primary-container rounded-full px-3 py-0.5 text-[11px] font-medium">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setStudyToggle((v) => !v)}
            className="flex items-center gap-1.5 text-[12px] font-medium"
            style={{ color: studyToggle ? '#7c9e8f' : '#727974', background: 'none', border: 'none' }}
          >
            <div
              className={`relative inline-flex h-5 w-9 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${studyToggle ? 'bg-primary-container' : 'bg-surface-variant'}`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${studyToggle ? 'translate-x-4' : 'translate-x-0'}`}
              />
            </div>
            Study
          </button>
        </div>

        {/* Post input */}
        <div className="bg-surface-container-lowest rounded-card shadow-warm p-md">
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value.slice(0, 500))}
            placeholder="Share something with the space..."
            rows={2}
            className="w-full resize-none border-none bg-transparent text-[14px] text-on-surface outline-none placeholder:text-outline"
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-[12px] text-outline">{newPost.length}/500</span>
            <button
              className="flex items-center gap-1 h-8 px-4 bg-primary-container text-on-primary rounded-btn text-[13px] font-medium hover:bg-primary transition-colors disabled:opacity-50"
              onClick={submitPost}
              disabled={!newPost.trim() || isPosting}
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              Post
            </button>
          </div>
        </div>

        {/* Posts */}
        {loadingPosts ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-surface-container-high animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="material-symbols-outlined text-outline text-[36px]">group</span>
            <p className="text-on-surface-variant">No posts yet. Be the first to share something!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map((post) => (
              <div key={post.id} className="bg-surface-container-lowest rounded-card shadow-warm p-md relative">
                <div className="flex justify-between mb-2">
                  <span className="text-[13px] font-medium text-on-surface">{post.author_name || 'Anonymous'}</span>
                  <div className="relative">
                    <button
                      className="text-outline hover:text-on-surface transition-colors text-lg leading-none px-2"
                      onClick={() => setMenuOpen(menuOpen === post.id ? null : post.id)}
                    >
                      ⋯
                    </button>
                    {menuOpen === post.id && (
                      <div className="absolute right-0 top-7 bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-warm p-1 z-10 min-w-[130px]">
                        <button
                          onClick={() => flagPost(post.id)}
                          disabled={flaggedPosts.has(post.id)}
                          className="flex items-center gap-2 px-3 py-2 text-[13px] text-tertiary hover:bg-surface-container-low rounded-lg w-full disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[13px]">flag</span>
                          {flaggedPosts.has(post.id) ? 'Flagged' : 'Flag post'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[14px] leading-relaxed text-on-surface">{post.content}</p>
                <p className="text-[11px] text-outline mt-2">
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
    <div className="flex flex-col gap-5 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-headline-md text-on-surface mb-1">Find Your People</h1>
        <p className="text-[14px] text-outline">Connect with people who get it</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[120px] rounded-2xl bg-surface-container-high animate-pulse" />
          ))}
        </div>
      ) : spaces.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="material-symbols-outlined text-outline text-[36px]">group</span>
          <p className="text-on-surface font-medium">No spaces available yet.</p>
          <p className="text-[13px] text-outline">Check back soon — your institution is setting things up.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {spaces.map((space) => (
            <div
              key={space.id}
              className="bg-surface-container-lowest rounded-card shadow-warm p-md flex flex-col gap-4 cursor-pointer hover:shadow-warm-glow transition-shadow"
              onClick={() => openSpace(space)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-[16px] font-medium text-on-surface leading-tight mb-1">{space.name}</h3>
                  <p className="text-[14px] text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">group</span>
                    {space.member_count} members
                  </p>
                </div>
              </div>
              {space.description && (
                <p className="text-[13px] text-on-surface-variant leading-relaxed">{space.description}</p>
              )}
              {space.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {space.tags.map((t) => (
                    <span key={t} className="rounded-full bg-surface-container-low px-[10px] py-[4px] text-[12px] font-medium text-on-surface-variant">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="border-t border-outline-variant/20 pt-3 flex items-center justify-end">
                <button className="text-[14px] font-medium text-primary-container flex items-center gap-1 hover:opacity-80 transition-opacity">
                  Join space <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suggest a space */}
      <button className="w-full flex items-center justify-center gap-2 py-6 border border-dashed border-outline-variant rounded-2xl bg-transparent hover:bg-surface-container-low transition-colors">
        <span className="material-symbols-outlined text-primary-container">add</span>
        <span className="text-[13px] font-medium text-primary-container">Suggest a space</span>
      </button>

      <p className="text-center text-[12px] text-outline px-4">
        You see people's study interests, not their wellness data.
      </p>
    </div>
  );
};
