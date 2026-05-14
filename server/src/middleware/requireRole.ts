import { Request, Response, NextFunction } from 'express';

export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Security: Never reveal what roles exist in the error message
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};
