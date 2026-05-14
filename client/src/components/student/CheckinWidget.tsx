import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiCall } from '../../lib/api';

type Dimension = 'emotional' | 'sleep' | 'social';

interface CheckinStatus {
  week_start: string;
  submitted: Dimension[];
  pending: Dimension[];
}

const EMOJI_SCALE = [
  { value: 1, emoji: '😢', label: 'Struggling' },
  { value: 2, emoji: '😟', label: 'Not Great' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😊', label: 'Great' }
];

const DIMENSION_PROMPTS: Record<Dimension, string> = {
  emotional: 'How are you feeling emotionally this week?',
  sleep: 'How has your sleep quality been?',
  social: 'How connected are you feeling socially?'
};

export const CheckinWidget: React.FC = () => {
  const { token } = useAuth();
  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchStatus = async () => {
    try {
      const data = await apiCall<CheckinStatus>('/api/checkins/status');
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch checkin status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchStatus();
  }, [token]);

  const handleSubmit = async (dimension: Dimension, score: number) => {
    if (submitting) return;
    setSubmitting(true);

    // Optimistic UI update
    const previousStatus = status;
    if (status) {
      setStatus({
        ...status,
        submitted: [...status.submitted, dimension],
        pending: status.pending.filter(d => d !== dimension)
      });
    }

    try {
      await apiCall('/api/checkins/submit', {
        method: 'POST',
        body: { dimension, response_score: score },
      });
    } catch (err) {
      console.error(err);
      // Revert on failure
      setStatus(previousStatus);
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-4 bg-gray-50 rounded-lg animate-pulse h-32"></div>;
  if (!status) return null;

  if (status.pending.length === 0) {
    return (
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center">
        <div className="text-4xl mb-3">🌿</div>
        <h3 className="text-lg font-medium text-emerald-800">All caught up!</h3>
        <p className="text-emerald-600 text-sm mt-1">Thank you for checking in this week. Your wellness journey matters.</p>
      </div>
    );
  }

  const activeDimension = status.pending[0];

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-gray-800">Weekly Check-in</h3>
        <span className="text-xs font-medium px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full">
          {3 - status.pending.length}/3 Completed
        </span>
      </div>

      <div className="text-center mb-8">
        <p className="text-xl font-medium text-gray-700">{DIMENSION_PROMPTS[activeDimension]}</p>
      </div>

      <div className="flex justify-center gap-4 sm:gap-6">
        {EMOJI_SCALE.map((item) => (
          <button
            key={item.value}
            disabled={submitting}
            onClick={() => handleSubmit(activeDimension, item.value)}
            className="flex flex-col items-center gap-2 group transition-transform hover:scale-110 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            aria-label={`Rate ${item.value} - ${item.label}`}
          >
            <div className="text-4xl sm:text-5xl filter grayscale-[0.2] group-hover:grayscale-0 transition-all drop-shadow-sm">
              {item.emoji}
            </div>
            <span className="text-xs text-gray-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
