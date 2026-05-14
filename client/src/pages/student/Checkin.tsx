import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../../lib/api';
import { ChevronLeft } from 'lucide-react';

const QUESTIONS = [
  {
    id: 'emotional_score',
    dimension: 'Emotional',
    emoji: '💙',
    text: 'How have you been feeling emotionally this week?',
  },
  {
    id: 'sleep_score',
    dimension: 'Rest',
    emoji: '🌙',
    text: 'How would you rate your sleep and rest this week?',
  },
  {
    id: 'academic_score',
    dimension: 'Academic',
    emoji: '📚',
    text: 'How are you feeling about your studies and workload?',
  },
  {
    id: 'social_score',
    dimension: 'Social',
    emoji: '🤝',
    text: 'How connected do you feel with the people around you?',
  },
];

const EMOJI_SCALE = [
  { value: 1, emoji: '😔', label: 'Very low' },
  { value: 2, emoji: '😕', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😊', label: 'Great' },
];

type Answers = Record<string, number>;

export const CheckinPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const question = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const progress = ((step) / QUESTIONS.length) * 100;

  const handleSelect = (val: number) => setSelected(val);

  const handleNext = async () => {
    if (selected === null) return;
    const newAnswers = { ...answers, [question.id]: selected };
    setAnswers(newAnswers);
    setSelected(null);

    if (isLast) {
      setIsSubmitting(true);
      try {
        await apiCall('/api/checkins/submit', {
          method: 'POST',
          body: newAnswers,
        });
        setIsDone(true);
      } catch (err: any) {
        setError(err.message || 'Something went wrong. Please try again.');
        setIsSubmitting(false);
      }
    } else {
      setStep((s) => s + 1);
    }
  };

  if (isDone) {
    return (
      <div className="fade-in" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: 'calc(100svh - 130px)', gap: 20, textAlign: 'center'
      }}>
        <div style={{ fontSize: 64 }}>🌟</div>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Check-in complete!</h2>
        <p style={{ color: 'var(--text-3)', fontSize: 15, maxWidth: 280, lineHeight: 1.6 }}>
          Thank you for taking a moment for yourself. Your wellbeing snapshot has been updated.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/student/dashboard')}>
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ minHeight: 'calc(100svh - 130px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/student/dashboard')}
          style={{ padding: '8px', borderRadius: '50%' }}>
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontSize: 14, color: 'var(--text-3)' }}>Weekly Check-in</span>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          {QUESTIONS.map((q, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: i < step ? 'var(--good)' : i === step ? 'var(--sage)' : 'var(--surface-raised)',
                border: i === step ? '2px solid var(--sage)' : '2px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, transition: 'all 0.3s',
                color: i <= step ? '#fff' : 'var(--text-3)'
              }}>
                {i < step ? '✓' : q.emoji}
              </div>
              <span style={{ fontSize: 10, color: i === step ? 'var(--sage)' : 'var(--text-3)' }}>
                {q.dimension}
              </span>
            </div>
          ))}
        </div>
        <div style={{ height: 3, background: 'var(--surface-raised)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: 'var(--sage)', borderRadius: 99,
            width: `${progress}%`, transition: 'width 0.5s ease'
          }} />
        </div>
      </div>

      {/* Question */}
      <div key={step} className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div>
          <div style={{ fontSize: 42, marginBottom: 16 }}>{question.emoji}</div>
          <h2 style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.4 }}>{question.text}</h2>
        </div>

        {/* Emoji Scale */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {EMOJI_SCALE.map(({ value, emoji, label }) => (
            <button
              key={value}
              onClick={() => handleSelect(value)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 6, padding: '14px 4px', borderRadius: 'var(--radius-md)',
                border: selected === value ? '2px solid var(--sage)' : '2px solid var(--border)',
                background: selected === value ? 'var(--sage-light)' : 'var(--surface)',
                cursor: 'pointer', transition: 'all 0.2s',
                transform: selected === value ? 'scale(1.08)' : 'scale(1)',
              }}
            >
              <span style={{ fontSize: 26 }}>{emoji}</span>
              <span style={{ fontSize: 10, color: selected === value ? 'var(--sage)' : 'var(--text-3)', fontWeight: 500 }}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div className="banner banner-attention">
            <p style={{ fontSize: 14 }}>{error}</p>
          </div>
        )}

        <button
          className="btn btn-primary btn-full"
          onClick={handleNext}
          disabled={selected === null || isSubmitting}
          style={{ opacity: selected === null ? 0.5 : 1, marginTop: 'auto' }}
        >
          {isSubmitting ? 'Saving...' : isLast ? 'Complete Check-in' : 'Next →'}
        </button>
      </div>
    </div>
  );
};
