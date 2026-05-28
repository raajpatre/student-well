import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../../lib/api';

interface AdaptiveQuestion {
  id: string;
  text: string;
  category: string;
  triggers: string[];
}

const QUESTIONS = [
  {
    id: 'emotional_score',
    dimension: 'Emotional',
    stepLabel: 'How you\'re feeling',
    text: 'How have you been feeling emotionally this week?',
  },
  {
    id: 'sleep_score',
    dimension: 'Rest',
    stepLabel: 'Your rest',
    text: 'How would you rate your sleep and rest this week?',
  },
  {
    id: 'academic_score',
    dimension: 'Academic',
    stepLabel: 'Your studies',
    text: 'How are you feeling about your studies and workload?',
  },
  {
    id: 'social_score',
    dimension: 'Social',
    stepLabel: 'Your connections',
    text: 'How connected do you feel with the people around you?',
  },
];

const EMOJI_SCALE = [
  { value: 1, emoji: '😔', label: 'Not great' },
  { value: 2, emoji: '😕', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😊', label: 'Really good' },
];

type Answers = Record<string, number>;

const TOTAL_STEPS = QUESTIONS.length + 1; // 4 scale questions + 1 optional reflection
const REFLECTION_STEP = QUESTIONS.length;

export const CheckinPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [reflection, setReflection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adaptive, setAdaptive] = useState<AdaptiveQuestion | null>(null);

  const isReflectionStep = step === REFLECTION_STEP;
  const question = isReflectionStep ? null : QUESTIONS[step];

  // Fetch one adaptive prompt up-front. If none come back, fall back to the default phrasing.
  useEffect(() => {
    let cancelled = false;
    apiCall<{ questions: AdaptiveQuestion[] }>('/api/student/questions/adaptive')
      .then((resp) => {
        if (cancelled) return;
        const top = resp?.questions?.[0];
        if (top) setAdaptive(top);
      })
      .catch(() => { /* silent — default prompt is fine */ });
    return () => { cancelled = true; };
  }, []);

  const submitAll = async (finalAnswers: Answers, reflectionText: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { ...finalAnswers };
      const trimmed = reflectionText.trim();
      if (trimmed.length > 0) body.reflection_text = trimmed.slice(0, 2000);
      await apiCall('/api/checkins/submit', { method: 'POST', body });
      setIsDone(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleSelect = (val: number) => setSelected(val);

  const handleNext = async () => {
    if (isReflectionStep) {
      await submitAll(answers, reflection);
      return;
    }
    if (selected === null || !question) return;
    const newAnswers = { ...answers, [question.id]: selected };
    setAnswers(newAnswers);
    setSelected(null);
    setStep((s) => s + 1);
  };

  const handleSkipReflection = async () => {
    await submitAll(answers, '');
  };

  if (isDone) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100svh-130px)] gap-6 text-center px-container-padding pb-8">
        <div className="text-[64px]">🌟</div>
        <h2 className="text-headline-md text-on-surface">Check-in complete!</h2>
        <p className="text-[15px] text-on-surface-variant max-w-[280px] leading-relaxed">
          Thank you for taking a moment for yourself. Your wellbeing snapshot has been updated.
        </p>
        <button
          className="h-[48px] px-8 bg-primary-container text-on-primary rounded-btn font-body-md hover:bg-primary transition-colors shadow-sm"
          onClick={() => navigate('/student/dashboard')}
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100svh-130px)] px-0 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-lg">
        <button
          className="text-on-surface-variant hover:opacity-80 transition-opacity"
          onClick={() => navigate('/student/dashboard')}
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-body-sm text-body-sm text-on-surface">Check-in</h1>
        <button
          className="text-on-surface-variant hover:opacity-80 transition-opacity"
          onClick={() => navigate('/student/dashboard')}
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1 bg-surface-container-high rounded-full overflow-hidden flex gap-1 mb-xl">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-full rounded-full flex-1 transition-colors duration-300 ${
              i <= step ? 'bg-primary-container' : 'bg-surface-container-high'
            }`}
          />
        ))}
      </div>

      {/* Question Block */}
      <div key={step} className="flex-grow flex flex-col items-center justify-center space-y-xl pb-32">
        {isReflectionStep ? (
          <>
            <div className="flex flex-col items-center text-center space-y-md">
              <span className="inline-flex items-center justify-center px-3 py-1 bg-primary-fixed text-on-primary-container rounded-full text-[11px] font-medium uppercase tracking-wider">
                Optional reflection
              </span>
              <h2 className="font-serif-display italic text-[22px] leading-tight text-on-tertiary-container max-w-[300px]">
                {adaptive?.text ?? "What's been weighing on you this week?"}
              </h2>
              <p className="font-body-sm text-[13px] text-on-surface-variant max-w-[280px]">
                A few sentences in your own words. Skip if you'd rather not.
              </p>
            </div>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value.slice(0, 2000))}
              placeholder="It's been a heavy week because…"
              rows={6}
              autoFocus
              className="w-full max-w-[340px] min-h-[140px] bg-surface-container-lowest border border-custom-divider rounded-input p-4 text-[14px] text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-colors resize-none"
            />
            <p className="text-[11px] text-outline">
              {reflection.length}/2000
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center text-center space-y-md">
              <span className="inline-flex items-center justify-center px-3 py-1 bg-primary-fixed text-on-primary-container rounded-full text-[11px] font-medium uppercase tracking-wider">
                {question!.stepLabel}
              </span>
              <h2 className="font-serif-display italic text-[22px] leading-tight text-on-tertiary-container max-w-[280px]">
                {question!.text}
              </h2>
              <p className="font-body-sm text-[13px] text-on-surface-variant max-w-[250px]">
                No right answer. Be honest with yourself.
              </p>
            </div>

            {/* Emoji Selection */}
            <div className="w-full max-w-[320px] pt-md">
              <div className="flex justify-between items-center w-full mb-xs">
                {EMOJI_SCALE.map(({ value, emoji }) => (
                  <button
                    key={value}
                    onClick={() => handleSelect(value)}
                    className={`w-[52px] h-[52px] rounded-full flex items-center justify-center text-2xl border shadow-warm transition-all duration-200 hover:-translate-y-1 ${
                      selected === value
                        ? 'bg-primary-container border-2 border-primary scale-110 z-10'
                        : 'bg-surface-container-lowest border-transparent'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex justify-between w-full px-2 text-[10px] text-on-surface-variant font-medium tracking-wide">
                <span>Not great</span>
                <span>Really good</span>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="bg-error-container text-on-error-container rounded-input px-4 py-3 text-[13px] w-full max-w-[320px]">
            {error}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 w-full px-container-padding pb-[88px] pt-md bg-gradient-to-t from-background via-background to-transparent flex flex-col items-center gap-2">
        <button
          className="w-full h-[48px] bg-primary-container text-on-primary-container rounded-xl font-body-sm text-body-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50"
          onClick={handleNext}
          disabled={isSubmitting || (!isReflectionStep && selected === null)}
        >
          {isSubmitting ? 'Saving...' : isReflectionStep ? 'Complete Check-in' : 'Next'}
          {!isSubmitting && (
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          )}
        </button>
        {isReflectionStep && (
          <button
            onClick={() => { void handleSkipReflection(); }}
            disabled={isSubmitting}
            className="text-[13px] text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
          >
            Skip
          </button>
        )}
        <div className="flex items-center gap-1 mt-md text-on-surface-variant opacity-80">
          <span className="material-symbols-outlined text-[14px]">lock</span>
          <span className="text-[12px]">This stays private to you.</span>
        </div>
      </div>
    </div>
  );
};
