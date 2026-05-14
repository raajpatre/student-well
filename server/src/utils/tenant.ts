import { Request } from 'express';

export const getTenantId = (req: Request): string => {
  if (!req.user || !req.user.tenant_id) {
    throw new Error('Tenant ID not found in request context. Ensure authMiddleware is applied.');
  }
  
  // SECURITY: always filter by tenant_id
  return req.user.tenant_id;
};
