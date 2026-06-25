import { Router } from 'express';
import { AuthRequest, authMiddleware, requirePermission } from '../middleware/auth.middleware';
import { listAuditLogs } from '../services/audit.service';
import {
  createDefinition,
  deleteDefinition,
  getDefinitionById,
  getEntityValues,
  listDefinitions,
  reorderDefinitions,
  saveEntityValues,
  updateDefinition,
  validateEntityValues,
} from '../services/custom-field.service';
import { CustomFieldDefinitionInput, CustomFieldValueInput } from '../types';

const router = Router();

router.use(authMiddleware);

router.get('/definitions', (req, res) => {
  const entityType = (reqQuery(req, 'entityType') as string) ?? 'student';
  const includeInactive = reqQuery(req, 'includeInactive') === 'true';
  res.json(listDefinitions(1, entityType, includeInactive));
});

router.get('/definitions/:id', (req, res) => {
  const def = getDefinitionById(Number(req.params.id));
  if (!def) {
    res.status(404).json({ error: 'Custom field definition not found' });
    return;
  }
  res.json(def);
});

router.post('/definitions', requirePermission('custom_field', 'manage'), (req: AuthRequest, res) => {
  const input = req.body as CustomFieldDefinitionInput;
  if (!input.fieldLabel || !input.fieldType) {
    res.status(400).json({ error: 'fieldLabel and fieldType are required' });
    return;
  }
  try {
    const created = createDefinition(input, req.user?.id);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create field' });
  }
});

router.put('/definitions/:id', requirePermission('custom_field', 'manage'), (req: AuthRequest, res) => {
  try {
    const updated = updateDefinition(Number(req.params.id), req.body, req.user?.id);
    if (!updated) {
      res.status(404).json({ error: 'Custom field definition not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update field' });
  }
});

router.delete('/definitions/:id', requirePermission('custom_field', 'manage'), (req: AuthRequest, res) => {
  const ok = deleteDefinition(Number(req.params.id), req.user?.id);
  if (!ok) {
    res.status(404).json({ error: 'Custom field definition not found' });
    return;
  }
  res.json({ success: true });
});

router.post('/definitions/reorder', requirePermission('custom_field', 'manage'), (req: AuthRequest, res) => {
  const { orderedIds, entityType } = req.body as { orderedIds?: number[]; entityType?: string };
  if (!orderedIds?.length) {
    res.status(400).json({ error: 'orderedIds array is required' });
    return;
  }
  res.json(reorderDefinitions(orderedIds, 1, entityType ?? 'student', req.user?.id));
});

router.get('/values/:entityType/:entityId', (req, res) => {
  const values = getEntityValues(req.params.entityType, Number(req.params.entityId));
  res.json(values);
});

router.put('/values/:entityType/:entityId', requirePermission('student', 'edit'), (req: AuthRequest, res) => {
  const entityType = String(req.params.entityType);
  const entityId = Number(req.params.entityId);
  const { values } = req.body as { values?: CustomFieldValueInput[] };
  if (!values) {
    res.status(400).json({ error: 'values array is required' });
    return;
  }
  try {
    const saved = saveEntityValues(entityType, entityId, values, req.user?.id);
    res.json(saved);
  } catch (err) {
    const details = (err as Error & { details?: Record<string, string> }).details;
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Validation failed',
      details,
    });
  }
});

router.post('/validate', (req, res) => {
  const { entityType, values } = req.body as {
    entityType?: string;
    values?: CustomFieldValueInput[];
  };
  if (!entityType || !values) {
    res.status(400).json({ error: 'entityType and values are required' });
    return;
  }
  res.json(validateEntityValues(entityType, values));
});

router.get('/audit/:entityType/:entityId', requirePermission('custom_field', 'manage'), (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  res.json(listAuditLogs(String(req.params.entityType), Number(req.params.entityId), limit));
});

function reqQuery(req: AuthRequest, key: string): string | undefined {
  const val = req.query[key];
  if (typeof val === 'string') {
    return val;
  }
  if (Array.isArray(val) && typeof val[0] === 'string') {
    return val[0];
  }
  return undefined;
}

export default router;
