// Aggregate re-export so each role portal can be code-split as a single
// dynamic import. UnauthorizedPage lives separately so App.tsx can import
// it statically without preventing Portals from being its own chunk.

export { ManagerPortalRouter as ManagerPortal } from './manager/index';
export { CounsellorPortalRouter as CounsellorPortal } from './counsellor/index';

// Keep old export name for backward compat with any external link.
export const StudentPortal = () => null;
