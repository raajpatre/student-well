import React, { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { apiCall } from '../../lib/api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CsvRow {
  full_name: string;
  roll_number: string;
  email: string;
  batch: string;
  semester: string;
  [key: string]: string;
}

interface RowValidation {
  row: CsvRow;
  valid: boolean;
  reason?: string;
}

interface BulkResult {
  total: number;
  invited: number;
  failed: number;
  errors: { row: number; email: string; reason: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const alphanumericRegex = /^[a-zA-Z0-9]+$/;

function validateRow(row: CsvRow): { valid: boolean; reason?: string } {
  if (!row.email || !emailRegex.test(row.email.trim())) return { valid: false, reason: 'Invalid email' };
  if (!row.full_name || !row.full_name.trim()) return { valid: false, reason: 'Missing name' };
  if (!row.roll_number || !alphanumericRegex.test(row.roll_number.trim())) return { valid: false, reason: 'Invalid roll number' };
  if (!row.batch || !row.batch.trim()) return { valid: false, reason: 'Missing batch' };
  const sem = parseInt(row.semester);
  if (!row.semester || isNaN(sem) || sem < 1 || sem > 8) return { valid: false, reason: 'Invalid semester (1–8)' };
  return { valid: true };
}

function downloadTemplate() {
  const header = 'full_name,roll_number,email,batch,semester';
  const example = 'Priya Sharma,NSTB25CS001,priya.sharma@gmail.com,NSTB\'25-CS,3';
  const blob = new Blob([header + '\n' + example], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'student_invite_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Bulk Tab ──────────────────────────────────────────────────────────────────

const BulkTab: React.FC = () => {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<RowValidation[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [sendError, setSendError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setSendError('');
    Papa.parse<CsvRow>(f, {
      header: true,
      skipEmptyLines: true,
      complete: parsed => {
        const validated: RowValidation[] = (parsed.data as CsvRow[]).map(row => ({
          row,
          ...validateRow(row),
        }));
        setRows(validated);
      },
    });
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) processFile(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const allValid = rows.length > 0 && rows.every(r => r.valid);
  const invalidCount = rows.filter(r => !r.valid).length;
  const preview = rows.slice(0, 5);

  const handleSend = async () => {
    if (!file) return;
    setSending(true);
    setSendError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('sw_token');
      const res = await fetch(`${BASE_URL}/api/manager/students/invite-bulk`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error || 'Failed to send invites');
        return;
      }
      setResult(data as BulkResult);
      setFile(null);
      setRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      setSendError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      {/* Template download */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-[13px] text-on-surface-variant">
          Upload a CSV with student details to invite up to 200 students at once.
        </p>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 text-[13px] text-primary-container hover:opacity-80 transition-opacity"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
          Download template
        </button>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragging ? 'border-primary-container bg-primary-fixed/10' : 'border-outline-variant hover:border-primary-container/60 hover:bg-surface-container-low'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <span className="material-symbols-outlined text-outline" style={{ fontSize: '32px' }}>upload_file</span>
        <p className="mt-2 text-[14px] text-on-surface-variant">
          {file ? file.name : 'Drag & drop a CSV file, or click to browse'}
        </p>
        {file && (
          <p className="text-[12px] text-outline mt-1">{rows.length} rows detected</p>
        )}
      </div>

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-medium text-on-surface">Preview (first 5 rows)</p>
            {invalidCount > 0 && (
              <span className="text-[12px] text-on-error-container">
                {invalidCount} row{invalidCount !== 1 ? 's' : ''} with errors
              </span>
            )}
            {allValid && (
              <span className="text-[12px] text-sage-green flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                All rows valid
              </span>
            )}
          </div>
          <div className="rounded-xl border border-custom-divider overflow-hidden">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-surface-container-low border-b border-custom-divider">
                <tr>
                  <th className="px-3 py-2 text-on-surface-variant font-medium">Name</th>
                  <th className="px-3 py-2 text-on-surface-variant font-medium">Roll No.</th>
                  <th className="px-3 py-2 text-on-surface-variant font-medium">Email</th>
                  <th className="px-3 py-2 text-on-surface-variant font-medium">Batch</th>
                  <th className="px-3 py-2 text-on-surface-variant font-medium">Sem</th>
                  <th className="px-3 py-2 text-on-surface-variant font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-custom-divider/50">
                {preview.map((r, i) => (
                  <tr key={i} className={r.valid ? '' : 'bg-error-container/10'}>
                    <td className="px-3 py-2 text-on-surface">{r.row.full_name || '—'}</td>
                    <td className="px-3 py-2 text-on-surface-variant">{r.row.roll_number || '—'}</td>
                    <td className="px-3 py-2 text-on-surface-variant">{r.row.email || '—'}</td>
                    <td className="px-3 py-2 text-on-surface-variant">{r.row.batch || '—'}</td>
                    <td className="px-3 py-2 text-on-surface-variant">{r.row.semester || '—'}</td>
                    <td className="px-3 py-2">
                      {r.valid
                        ? <span className="text-sage-green flex items-center gap-1">
                            <span className="material-symbols-outlined" style={{ fontSize: '13px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            OK
                          </span>
                        : <span className="text-on-error-container">{r.reason}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 5 && (
            <p className="text-[11px] text-outline mt-1.5 text-right">+{rows.length - 5} more rows</p>
          )}
        </div>
      )}

      {sendError && (
        <div className="mt-4 bg-error-container text-on-error-container rounded-input px-4 py-3 text-[13px]">
          {sendError}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-5 bg-surface-container-low rounded-xl p-4">
          <p className="text-[14px] font-medium text-on-surface mb-1">
            {result.invited} invite{result.invited !== 1 ? 's' : ''} sent
            {result.failed > 0 && <span className="text-on-error-container"> · {result.failed} failed</span>}
          </p>
          {result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="text-[12px] text-on-surface-variant cursor-pointer hover:text-on-surface">
                Show errors ({result.errors.length})
              </summary>
              <div className="mt-2 space-y-1">
                {result.errors.map((e, i) => (
                  <div key={i} className="text-[12px] text-on-error-container">
                    Row {e.row} ({e.email || 'no email'}): {e.reason}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Send button */}
      {file && rows.length > 0 && !result && (
        <div className="mt-5">
          <button
            onClick={handleSend}
            disabled={sending || !allValid}
            className="px-6 py-2.5 bg-primary-container text-on-primary rounded-btn text-[14px] font-medium hover:bg-primary transition-colors disabled:opacity-50"
          >
            {sending ? 'Sending invites…' : `Send ${rows.length} invite${rows.length !== 1 ? 's' : ''}`}
          </button>
          {!allValid && (
            <p className="mt-1.5 text-[12px] text-on-error-container">Fix the errors above before sending</p>
          )}
        </div>
      )}
    </div>
  );
};

// ── Single Invite Tab ─────────────────────────────────────────────────────────

const SingleTab: React.FC = () => {
  const [form, setForm] = useState({
    full_name: '',
    roll_number: '',
    email: '',
    batch: '',
    semester: '1',
  });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setSuccess('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    setSuccess('');

    try {
      await apiCall('/api/manager/students/invite-single', {
        method: 'POST',
        body: { ...form, semester: parseInt(form.semester) },
      });
      setSuccess(`Invite sent to ${form.email}`);
      setForm({ full_name: '', roll_number: '', email: '', batch: '', semester: '1' });
    } catch (err: any) {
      setError(err.message || 'Failed to send invite');
    } finally {
      setSending(false);
    }
  };

  const inputCls = 'w-full h-[44px] bg-background border border-custom-divider rounded-input px-4 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container transition-colors';

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      {success && (
        <div className="bg-primary-fixed/30 text-on-surface rounded-input px-4 py-3 text-[13px] flex items-center gap-2">
          <span className="material-symbols-outlined text-sage-green" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {success}
        </div>
      )}
      {error && (
        <div className="bg-error-container text-on-error-container rounded-input px-4 py-3 text-[13px]">
          {error}
        </div>
      )}

      <div>
        <label className="block text-[12px] text-on-surface-variant mb-1">Full name</label>
        <input value={form.full_name} onChange={handleChange('full_name')} placeholder="Priya Sharma" required className={inputCls} />
      </div>
      <div>
        <label className="block text-[12px] text-on-surface-variant mb-1">Roll number</label>
        <input value={form.roll_number} onChange={handleChange('roll_number')} placeholder="NSTB25CS001" required pattern="[a-zA-Z0-9]+" title="Alphanumeric only" className={inputCls} />
      </div>
      <div>
        <label className="block text-[12px] text-on-surface-variant mb-1">Email</label>
        <input type="email" value={form.email} onChange={handleChange('email')} placeholder="priya@gmail.com" required className={inputCls} />
      </div>
      <div>
        <label className="block text-[12px] text-on-surface-variant mb-1">Batch</label>
        <input value={form.batch} onChange={handleChange('batch')} placeholder="NSTB'25-CS" required className={inputCls} />
      </div>
      <div>
        <label className="block text-[12px] text-on-surface-variant mb-1">Semester</label>
        <select value={form.semester} onChange={handleChange('semester')} className={`${inputCls} cursor-pointer`}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
            <option key={s} value={s}>Semester {s}</option>
          ))}
        </select>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={sending}
          className="px-6 py-2.5 bg-primary-container text-on-primary rounded-btn text-[14px] font-medium hover:bg-primary transition-colors disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send Invite'}
        </button>
      </div>
    </form>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export const OnboardStudents: React.FC = () => {
  const [tab, setTab] = useState<'bulk' | 'single'>('bulk');

  return (
    <div className="px-8 py-8 max-w-[900px] mx-auto">
      <div className="mb-xl">
        <h1 className="text-[22px] font-light text-on-surface mb-1">Onboard Students</h1>
        <p className="text-[13px] text-on-surface-variant">
          Invite students by uploading a CSV or adding them one at a time. Each student gets an activation link by email.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-lg bg-surface-container-low rounded-full p-1 w-fit">
        {(['bulk', 'single'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-full text-[13px] font-medium transition-colors ${
              tab === t
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-outline hover:text-on-surface-variant'
            }`}
          >
            {t === 'bulk' ? 'Invite Students (CSV)' : 'Invite One Student'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-surface-container-lowest rounded-card shadow-warm p-lg">
        {tab === 'bulk' ? <BulkTab /> : <SingleTab />}
      </div>
    </div>
  );
};
