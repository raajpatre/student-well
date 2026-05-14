# StudentWell Frontend Context

## Stack
- React + Vite + TypeScript
- Supabase Auth (client-side auth only)
- All data fetched from our Node.js backend at VITE_API_BASE_URL
- No direct Supabase data queries from the client — everything goes through the backend API
- Styling: plain CSS with CSS custom properties (no Tailwind, no CSS-in-JS)

## Design System (from Stitch)
All screens were designed in Google Stitch. The HTML files are in:
- /stitch/student/ — 15 screens
- /stitch/manager/ — 8 screens  
- /stitch/counsellor/ — 5 screens
- /stitch/other/ — 3 screens

CSS custom properties to use everywhere:
--bg: #FAF8F5
--surface: #FFFFFF
--surface-warm: #FDF5EE
--surface-muted: #F4F1EC
--border: #E8E2D9
--border-focus: #C4A882
--sage: #7C9E8F
--sage-deep: #4A6B5E
--sage-light: #EBF2EE
--terra: #D4956A
--terra-deep: #C07D54
--terra-light: #FBF0E8
--text: #2C2417
--text-2: #7A6F63
--text-3: #B0A89E
--radius-card: 18px
--radius-btn: 12px
--radius-pill: 999px
--shadow: 0 2px 12px rgba(44,36,23,0.07)
Font: DM Sans (300, 400, 500) — already loaded via Google Fonts in index.html

## Auth Pattern
- Token stored in localStorage as 'sw_token'
- Every API request sends: Authorization: Bearer <token>
- AuthContext provides: user, token, isAuthenticated, isLoading, login(), logout()
- Three roles: student, counsellor, manager — each lands on a different portal

## Folder Structure Convention
/client/src/
  /components/shared/     — shared across portals (Button, Card, Badge, BottomNav, etc)
  /components/student/    — student portal components
  /components/manager/    — manager portal components
  /components/counsellor/ — counsellor portal components
  /pages/student/         — student portal pages
  /pages/manager/         — manager portal pages
  /pages/counsellor/      — counsellor portal pages
  /hooks/                 — useAuth, useWellness, useCheckin, useChat, etc
  /api/                   — one file per feature: wellness.ts, checkin.ts, chat.ts, etc
  /context/               — AuthContext, NotificationContext
  /styles/                — global.css with CSS variables

## API Base Pattern
All API calls use this pattern:
const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/route`, {
  headers: { Authorization: `Bearer ${token}` }
})