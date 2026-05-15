import React, { useState } from 'react';
import { apiCall } from '../../lib/api';

interface PrivacyContentItem {
  icon: string;
  label: string;
  desc: string;
  filled?: boolean;
  numbered?: boolean;
}

interface PrivacySection {
  id: string;
  title: string;
  content: PrivacyContentItem[];
}

const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: 'what_we_know',
    title: 'What we know about you',
    content: [
      {
        icon: 'bar_chart',
        label: 'Attendance data',
        desc: 'From college system',
      },
      {
        icon: 'check_circle',
        label: 'Weekly check-in responses',
        desc: 'Your mood and answers',
        filled: true,
      },
      {
        icon: 'chat_bubble',
        label: 'Counsellor chat sessions',
        desc: 'Your messages only',
      },
      {
        icon: 'smartphone',
        label: 'App activity',
        desc: 'When you log in',
      },
    ],
  },
  {
    id: 'college_sees',
    title: 'What your college sees',
    content: [
      {
        icon: 'visibility',
        label: 'Nothing identifiable',
        desc: 'Your college sees anonymous patterns, not your name, until a counsellor reaches out to you first.',
      },
    ],
  },
  {
    id: 'escalation',
    title: 'What triggers a notification',
    content: [
      {
        icon: '1',
        label: 'Sustained low check-ins for 3+ weeks',
        desc: 'Automated gentle nudge',
        numbered: true,
      },
      {
        icon: '2',
        label: 'Distress signals in chat',
        desc: "You'll be asked first",
        numbered: true,
      },
      {
        icon: '3',
        label: 'Immediate safety concerns',
        desc: 'Emergency contacts are provided immediately',
        numbered: true,
      },
    ],
  },
  {
    id: 'your_controls',
    title: 'Your controls',
    content: [],
  },
];

export const PrivacyPage: React.FC = () => {
  const [expanded, setExpanded] = useState<string | null>('what_we_know');
  const [showOptOutConfirm, setShowOptOutConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const toggle = (id: string) => setExpanded((prev) => (prev === id ? null : id));

  const handleDeleteHistory = async () => {
    setIsDeleting(true);
    try {
      await apiCall('/api/student/checkin-history', { method: 'DELETE' });
      setSuccessMsg('Your check-in history has been deleted.');
    } catch {}
    setIsDeleting(false);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const data = await apiCall<Record<string, unknown>>('/api/student/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'my-data.json'; a.click();
      URL.revokeObjectURL(url);
    } catch {}
    setIsDownloading(false);
  };

  return (
    <div className="flex flex-col gap-lg pb-8 pt-4">
      {/* Header */}
      <div>
        <h1 className="text-headline-md text-on-surface mb-1">Your Privacy</h1>
        <p className="text-[14px] text-outline">You are in control of your data.</p>
      </div>

      {/* Opening card */}
      <section className="bg-surface-container-lowest rounded-card shadow-warm border-l-[3px] border-l-custom-terracotta p-md flex items-start gap-md">
        <div className="shrink-0 bg-primary-fixed/20 rounded-full p-2 flex items-center justify-center">
          <span
            className="material-symbols-outlined text-primary-container text-[28px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            verified_user
          </span>
        </div>
        <div className="flex-1">
          <h2 className="text-[16px] font-medium text-on-surface mb-1">You are in control.</h2>
          <p className="text-[13px] text-on-surface-variant">Here's exactly what we know, and what we share.</p>
        </div>
      </section>

      {successMsg && (
        <div className="bg-primary-fixed/30 border border-primary-container/30 rounded-input px-4 py-3 text-[13px] text-on-primary-container">
          {successMsg}
        </div>
      )}

      {/* Accordion */}
      <div className="space-y-4">
        {PRIVACY_SECTIONS.map(({ id, title, content }) => (
          <div key={id} className="bg-surface-container-lowest rounded-card shadow-warm overflow-hidden">
            <button
              className="flex items-center justify-between p-md w-full text-left cursor-pointer"
              onClick={() => toggle(id)}
            >
              <h3 className="text-[16px] font-medium text-on-surface">{title}</h3>
              <span
                className="material-symbols-outlined text-outline transition-transform duration-200"
                style={expanded === id ? { transform: 'rotate(180deg)' } : undefined}
              >
                expand_more
              </span>
            </button>

            {expanded === id && (
              <div className="border-t border-surface-variant/30">
                {id === 'your_controls' ? (
                  <div className="px-md pb-md pt-0 space-y-1">
                    <button
                      className="w-full flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-surface-container-low transition-colors text-left"
                      onClick={handleDeleteHistory}
                      disabled={isDeleting}
                    >
                      <span className="material-symbols-outlined text-custom-terracotta opacity-80 text-[20px]">delete</span>
                      <div>
                        <p className="text-[15px] font-medium text-custom-terracotta">Delete check-in history</p>
                        <p className="text-[11px] text-outline mt-0.5">Removes past mood data</p>
                      </div>
                    </button>
                    <button
                      className="w-full flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-surface-container-low transition-colors text-left"
                      onClick={handleDownload}
                      disabled={isDownloading}
                    >
                      <span className="material-symbols-outlined text-primary-container text-[20px]">download</span>
                      <p className="text-[15px] font-medium text-primary-container">
                        {isDownloading ? 'Preparing your data...' : 'Download my data'}
                      </p>
                    </button>
                    {!showOptOutConfirm ? (
                      <button
                        className="w-full flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-surface-container-low transition-colors text-left"
                        onClick={() => setShowOptOutConfirm(true)}
                      >
                        <span className="material-symbols-outlined text-custom-terracotta opacity-80 text-[20px]">logout</span>
                        <div>
                          <p className="text-[15px] font-medium text-custom-terracotta">Opt out of monitoring</p>
                          <p className="text-[11px] text-outline mt-0.5">You can leave anytime.</p>
                        </div>
                      </button>
                    ) : (
                      <div className="bg-error-container/30 border border-tertiary/20 rounded-xl p-4 mt-2">
                        <p className="text-[14px] font-medium text-on-surface mb-2">Are you sure?</p>
                        <p className="text-[13px] text-on-surface-variant leading-relaxed mb-4">
                          Opting out will stop all wellness tracking. Your college support team won't be able to proactively reach out. You can always opt back in.
                        </p>
                        <div className="flex gap-3">
                          <button
                            className="px-4 py-2 rounded-btn text-[13px] font-medium border border-outline-variant/50 text-on-surface hover:bg-surface-container-low transition-colors"
                            onClick={() => setShowOptOutConfirm(false)}
                          >
                            Cancel
                          </button>
                          <button
                            className="px-4 py-2 rounded-btn text-[13px] font-medium bg-tertiary text-on-tertiary hover:opacity-90 transition-opacity"
                            onClick={() => {
                              setShowOptOutConfirm(false);
                              setSuccessMsg('Opt-out request submitted. It will take effect within 24 hours.');
                            }}
                          >
                            Yes, opt out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : id === 'escalation' ? (
                  <div className="px-md pb-md pt-0 space-y-4 relative">
                    <div className="absolute left-[43px] top-2 bottom-4 w-px bg-surface-variant z-0" />
                    {content.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 relative z-10 pt-3">
                        <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center shrink-0 mt-0.5 border-2 border-white">
                          <span className="text-[11px] font-medium text-on-surface">{item.icon}</span>
                        </div>
                        <div>
                          <p className="text-[14px] font-medium text-on-surface">{item.label}</p>
                          <p className="text-[12px] text-outline mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-md pb-md pt-0 space-y-4">
                    {content.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 pt-3">
                        <span
                          className="material-symbols-outlined text-primary/70 mt-0.5 text-[20px]"
                          style={item.filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
                        >
                          {item.icon}
                        </span>
                        <div>
                          <p className="text-[14px] font-medium text-on-surface">{item.label}</p>
                          <p className="text-[11px] text-outline mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="pt-xl pb-lg text-center px-4">
        <p className="text-[13px] text-on-surface-variant">
          Questions?{' '}
          <a href="#" className="underline underline-offset-2 decoration-outline-variant hover:text-primary transition-colors">
            Reach your college's StudentWell manager.
          </a>
        </p>
      </div>
    </div>
  );
};
