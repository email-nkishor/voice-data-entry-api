import { getRepository } from '../db/database';
import {
  CustomFieldDefinition,
  CustomFieldDefinitionInput,
  CustomFieldType,
  CustomFieldValidationRules,
  CustomFieldValue,
  CustomFieldValueInput,
} from '../types';
import { logAudit } from './audit.service';

const FIELD_TYPES: CustomFieldType[] = [
  'text',
  'number',
  'date',
  'dropdown',
  'multiselect',
  'boolean',
];

export function slugifyFieldName(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64) || 'field';
}

export function parseValidationRules(json: string | null): CustomFieldValidationRules {
  if (!json) {
    return {};
  }
  try {
    return JSON.parse(json) as CustomFieldValidationRules;
  } catch {
    return {};
  }
}

export function definitionToApi(def: CustomFieldDefinition) {
  return {
    id: def.id,
    organizationId: def.organization_id,
    entityType: def.entity_type,
    fieldName: def.field_name,
    fieldLabel: def.field_label,
    fieldType: def.field_type,
    isRequired: !!def.is_required,
    defaultValue: def.default_value,
    validationRules: parseValidationRules(def.validation_rules_json),
    displayOrder: def.display_order,
    isActive: !!def.is_active,
    clientId: def.client_id,
    createdAt: def.created_at,
    updatedAt: def.updated_at,
  };
}

export function valueToApi(
  val: CustomFieldValue,
  definition?: CustomFieldDefinition
) {
  return {
    id: val.id,
    fieldDefinitionId: val.field_definition_id,
    fieldName: definition?.field_name,
    entityType: val.entity_type,
    entityId: val.entity_id,
    value: deserializeValue(val.value_text, definition?.field_type),
    rawValue: val.value_text,
    clientId: val.client_id,
    updatedAt: val.updated_at,
  };
}

export function listDefinitions(
  organizationId = 1,
  entityType = 'student',
  includeInactive = false
) {
  return getRepository()
    .listCustomFieldDefinitions({ organizationId, entityType, includeInactive })
    .sort((a, b) => a.display_order - b.display_order || a.id - b.id)
    .map(definitionToApi);
}

export function getDefinitionById(id: number) {
  const def = getRepository().getCustomFieldDefinitionById(id);
  return def ? definitionToApi(def) : undefined;
}

export function createDefinition(input: CustomFieldDefinitionInput, userId?: number) {
  const repo = getRepository();
  const organizationId = 1;
  const entityType = input.entityType ?? 'student';
  const fieldName =
    input.fieldName?.trim() ||
    slugifyFieldName(input.fieldLabel);

  if (!FIELD_TYPES.includes(input.fieldType)) {
    throw new Error('Invalid field type');
  }

  const existing = repo.getCustomFieldDefinitionByName(organizationId, entityType, fieldName);
  if (existing) {
    throw new Error(`Field name "${fieldName}" already exists`);
  }

  validateRulesForType(input.fieldType, input.validationRules);

  const now = new Date().toISOString();
  const definitions = repo.listCustomFieldDefinitions({ organizationId, entityType, includeInactive: true });
  const maxOrder = definitions.reduce((max, d) => Math.max(max, d.display_order), 0);

  const def: CustomFieldDefinition = {
    id: repo.nextId('customFieldDefinitions'),
    organization_id: organizationId,
    entity_type: entityType,
    field_name: fieldName,
    field_label: input.fieldLabel.trim(),
    field_type: input.fieldType,
    is_required: input.isRequired ? 1 : 0,
    default_value: input.defaultValue ?? null,
    validation_rules_json: input.validationRules ? JSON.stringify(input.validationRules) : null,
    display_order: input.displayOrder ?? maxOrder + 1,
    is_active: input.isActive === false ? 0 : 1,
    client_id: input.clientId ?? null,
    created_at: now,
    updated_at: now,
  };

  repo.insertCustomFieldDefinition(def);
  logAudit('custom_field_definition', def.id, 'create', { fieldName: def.field_name, fieldLabel: def.field_label }, userId);
  return definitionToApi(def);
}

export function updateDefinition(
  id: number,
  input: Partial<CustomFieldDefinitionInput>,
  userId?: number
) {
  const repo = getRepository();
  const existing = repo.getCustomFieldDefinitionById(id);
  if (!existing) {
    return undefined;
  }

  if (input.fieldType) {
    validateRulesForType(input.fieldType, input.validationRules ?? parseValidationRules(existing.validation_rules_json));
  }

  const updated: CustomFieldDefinition = {
    ...existing,
    field_label: input.fieldLabel?.trim() ?? existing.field_label,
    field_type: input.fieldType ?? existing.field_type,
    is_required: input.isRequired !== undefined ? (input.isRequired ? 1 : 0) : existing.is_required,
    default_value: input.defaultValue !== undefined ? (input.defaultValue ?? null) : existing.default_value,
    validation_rules_json:
      input.validationRules !== undefined
        ? JSON.stringify(input.validationRules)
        : existing.validation_rules_json,
    display_order: input.displayOrder ?? existing.display_order,
    is_active: input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.is_active,
    updated_at: new Date().toISOString(),
  };

  repo.updateCustomFieldDefinition(updated);
  logAudit('custom_field_definition', id, 'update', { changes: input }, userId);
  return definitionToApi(updated);
}

export function deleteDefinition(id: number, userId?: number): boolean {
  const repo = getRepository();
  const existing = repo.getCustomFieldDefinitionById(id);
  if (!existing) {
    return false;
  }
  const softDeleted: CustomFieldDefinition = {
    ...existing,
    is_active: 0,
    updated_at: new Date().toISOString(),
  };
  repo.updateCustomFieldDefinition(softDeleted);
  logAudit('custom_field_definition', id, 'deactivate', { fieldName: existing.field_name }, userId);
  return true;
}

export function reorderDefinitions(
  orderedIds: number[],
  organizationId = 1,
  entityType = 'student',
  userId?: number
) {
  const repo = getRepository();
  orderedIds.forEach((id, index) => {
    const def = repo.getCustomFieldDefinitionById(id);
    if (!def || def.organization_id !== organizationId || def.entity_type !== entityType) {
      return;
    }
    repo.updateCustomFieldDefinition({
      ...def,
      display_order: index + 1,
      updated_at: new Date().toISOString(),
    });
  });
  logAudit('custom_field_definition', 0, 'reorder', { orderedIds }, userId);
  return listDefinitions(organizationId, entityType, true);
}

export function getEntityValues(entityType: string, entityId: number) {
  const repo = getRepository();
  const values = repo.listCustomFieldValues(entityType, entityId);
  const definitions = repo.listCustomFieldDefinitions({
    organizationId: 1,
    entityType,
    includeInactive: true,
  });
  const defMap = new Map(definitions.map((d) => [d.id, d]));

  return values
    .map((v) => valueToApi(v, defMap.get(v.field_definition_id)))
    .filter((v) => {
      const def = defMap.get(v.fieldDefinitionId);
      return def?.is_active;
    });
}

export function getEntityValuesMap(entityType: string, entityId: number): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of getEntityValues(entityType, entityId)) {
    if (item.fieldName) {
      result[item.fieldName] = formatValueForStorage(item.value);
    }
  }
  return result;
}

export function saveEntityValues(
  entityType: string,
  entityId: number,
  inputs: CustomFieldValueInput[],
  userId?: number
) {
  const repo = getRepository();
  const definitions = repo.listCustomFieldDefinitions({
    organizationId: 1,
    entityType,
    includeInactive: false,
  });
  const defById = new Map(definitions.map((d) => [d.id, d]));
  const defByName = new Map(definitions.map((d) => [d.field_name, d]));

  const errors: Record<string, string> = {};
  const saved = [];

  for (const input of inputs) {
    const def =
      (input.fieldDefinitionId ? defById.get(input.fieldDefinitionId) : undefined) ??
      (input.fieldName ? defByName.get(input.fieldName) : undefined);

    if (!def) {
      continue;
    }

    const validation = validateFieldValue(def, input.value);
    if (!validation.valid) {
      errors[def.field_name] = validation.error ?? 'Invalid value';
      continue;
    }

    const now = new Date().toISOString();
    const stored = serializeValue(input.value, def.field_type);
    const record: CustomFieldValue = {
      id: repo.nextId('customFieldValues'),
      organization_id: def.organization_id,
      field_definition_id: def.id,
      entity_type: entityType,
      entity_id: entityId,
      value_text: stored,
      client_id: null,
      updated_at: now,
    };
    const upserted = repo.upsertCustomFieldValue(record);
    saved.push(valueToApi(upserted, def));
  }

  if (Object.keys(errors).length > 0) {
    const err = new Error('Validation failed') as Error & { details: Record<string, string> };
    err.details = errors;
    throw err;
  }

  logAudit(
    entityType,
    entityId,
    'custom_fields_update',
    { fields: saved.map((s) => s.fieldName) },
    userId
  );

  return saved;
}

export function validateFieldValue(
  def: CustomFieldDefinition,
  value: CustomFieldValueInput['value']
): { valid: boolean; error?: string } {
  const rules = parseValidationRules(def.validation_rules_json);
  const isEmpty =
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);

  if (def.is_required && isEmpty) {
    return { valid: false, error: `${def.field_label} is required` };
  }

  if (isEmpty) {
    return { valid: true };
  }

  switch (def.field_type) {
    case 'text': {
      const str = String(value);
      if (rules.minLength !== undefined && str.length < rules.minLength) {
        return { valid: false, error: `Minimum length is ${rules.minLength}` };
      }
      if (rules.maxLength !== undefined && str.length > rules.maxLength) {
        return { valid: false, error: `Maximum length is ${rules.maxLength}` };
      }
      if (rules.pattern && !new RegExp(rules.pattern).test(str)) {
        return { valid: false, error: 'Invalid format' };
      }
      return { valid: true };
    }
    case 'number': {
      const num = Number(value);
      if (Number.isNaN(num)) {
        return { valid: false, error: 'Must be a number' };
      }
      if (rules.min !== undefined && num < rules.min) {
        return { valid: false, error: `Minimum value is ${rules.min}` };
      }
      if (rules.max !== undefined && num > rules.max) {
        return { valid: false, error: `Maximum value is ${rules.max}` };
      }
      return { valid: true };
    }
    case 'date': {
      const str = String(value);
      if (rules.minDate && str < rules.minDate) {
        return { valid: false, error: `Date must be on or after ${rules.minDate}` };
      }
      if (rules.maxDate && str > rules.maxDate) {
        return { valid: false, error: `Date must be on or before ${rules.maxDate}` };
      }
      return { valid: true };
    }
    case 'dropdown': {
      const str = String(value);
      const options = rules.options ?? [];
      if (options.length && !options.some((o) => o.value === str)) {
        return { valid: false, error: 'Invalid selection' };
      }
      return { valid: true };
    }
    case 'multiselect': {
      const arr = Array.isArray(value) ? value.map(String) : String(value).split(',').map((s) => s.trim()).filter(Boolean);
      const options = rules.options ?? [];
      if (options.length) {
        const allowed = new Set(options.map((o) => o.value));
        if (arr.some((v) => !allowed.has(v))) {
          return { valid: false, error: 'Invalid selection' };
        }
      }
      return { valid: true };
    }
    case 'boolean':
      return { valid: true };
    default:
      return { valid: true };
  }
}

export function validateEntityValues(
  entityType: string,
  values: CustomFieldValueInput[]
): { valid: boolean; errors: Record<string, string> } {
  const repo = getRepository();
  const definitions = repo.listCustomFieldDefinitions({
    organizationId: 1,
    entityType,
    includeInactive: false,
  });
  const defById = new Map(definitions.map((d) => [d.id, d]));
  const defByName = new Map(definitions.map((d) => [d.field_name, d]));
  const errors: Record<string, string> = {};
  const provided = new Set<string>();

  for (const input of values) {
    const def =
      (input.fieldDefinitionId ? defById.get(input.fieldDefinitionId) : undefined) ??
      (input.fieldName ? defByName.get(input.fieldName) : undefined);
    if (!def) {
      continue;
    }
    provided.add(def.field_name);
    const result = validateFieldValue(def, input.value);
    if (!result.valid && result.error) {
      errors[def.field_name] = result.error;
    }
  }

  for (const def of definitions) {
    if (def.is_required && !provided.has(def.field_name)) {
      const hasDefault = def.default_value !== null && def.default_value !== '';
      if (!hasDefault) {
        errors[def.field_name] = `${def.field_label} is required`;
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

function validateRulesForType(
  fieldType: CustomFieldType,
  rules?: CustomFieldValidationRules
): void {
  if ((fieldType === 'dropdown' || fieldType === 'multiselect') && rules?.options?.length === 0) {
    throw new Error('Dropdown and multiselect fields require at least one option');
  }
}

function serializeValue(
  value: CustomFieldValueInput['value'],
  fieldType: CustomFieldType
): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (fieldType === 'multiselect') {
    const arr = Array.isArray(value) ? value : String(value).split(',').map((s) => s.trim());
    return JSON.stringify(arr);
  }
  if (fieldType === 'boolean') {
    return value === true || value === 'true' || value === '1' ? 'true' : 'false';
  }
  return String(value);
}

function deserializeValue(raw: string | null, fieldType?: CustomFieldType): unknown {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (fieldType === 'multiselect') {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return raw.split(',').map((s) => s.trim());
    }
  }
  if (fieldType === 'boolean') {
    return raw === 'true' || raw === '1';
  }
  if (fieldType === 'number') {
    return Number(raw);
  }
  return raw;
}

function formatValueForStorage(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

export function seedDefaultCustomFields(): void {
  const repo = getRepository();
  const existing = repo.listCustomFieldDefinitions({ organizationId: 1, entityType: 'student' });
  if (existing.length > 0) {
    return;
  }

  const samples: CustomFieldDefinitionInput[] = [
    {
      fieldLabel: 'Blood Group',
      fieldName: 'blood_group',
      fieldType: 'dropdown',
      validationRules: {
        options: [
          { value: 'A+', label: 'A+' },
          { value: 'B+', label: 'B+' },
          { value: 'O+', label: 'O+' },
          { value: 'AB+', label: 'AB+' },
          { value: 'A-', label: 'A-' },
          { value: 'B-', label: 'B-' },
          { value: 'O-', label: 'O-' },
          { value: 'AB-', label: 'AB-' },
        ],
      },
      displayOrder: 1,
    },
    {
      fieldLabel: 'House Name',
      fieldName: 'house_name',
      fieldType: 'dropdown',
      validationRules: {
        options: [
          { value: 'red', label: 'Red House' },
          { value: 'blue', label: 'Blue House' },
          { value: 'green', label: 'Green House' },
          { value: 'yellow', label: 'Yellow House' },
        ],
      },
      displayOrder: 2,
    },
    {
      fieldLabel: 'Bus Route',
      fieldName: 'bus_route',
      fieldType: 'text',
      displayOrder: 3,
    },
    {
      fieldLabel: 'Scholarship Type',
      fieldName: 'scholarship_type',
      fieldType: 'text',
      displayOrder: 4,
    },
    {
      fieldLabel: 'Admission Category',
      fieldName: 'admission_category',
      fieldType: 'dropdown',
      isRequired: false,
      validationRules: {
        options: [
          { value: 'general', label: 'General' },
          { value: 'reserved', label: 'Reserved' },
          { value: 'management', label: 'Management Quota' },
        ],
      },
      displayOrder: 5,
    },
  ];

  for (const sample of samples) {
    createDefinition(sample);
  }
}

export function migrateStudentCustomDataToEav(studentId: number, customData: string | null): void {
  if (!customData) {
    return;
  }
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(customData) as Record<string, string>;
  } catch {
    return;
  }

  const inputs: CustomFieldValueInput[] = [];
  for (const [fieldName, value] of Object.entries(parsed)) {
    if (value !== undefined && value !== '') {
      inputs.push({ fieldName, value });
    }
  }
  if (inputs.length) {
    try {
      saveEntityValues('student', studentId, inputs);
    } catch {
      // ignore partial migration failures
    }
  }
}
