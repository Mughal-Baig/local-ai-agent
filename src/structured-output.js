"use strict";

const STRUCTURED_OUTPUT_SCHEMAS = [
  {
    id: "task-list",
    title: "Task list",
    description: "Extract action items into a stable task list.",
    schema: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              priority: { type: "string", enum: ["low", "medium", "high"] },
              owner: { type: "string" },
              done: { type: "boolean" }
            },
            required: ["title", "priority"],
            additionalProperties: false
          }
        }
      },
      required: ["tasks"],
      additionalProperties: false
    }
  },
  {
    id: "table-extract",
    title: "Table extract",
    description: "Extract tabular facts into columns and row objects.",
    schema: {
      type: "object",
      properties: {
        columns: {
          type: "array",
          minItems: 1,
          items: { type: "string" }
        },
        rows: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true
          }
        }
      },
      required: ["columns", "rows"],
      additionalProperties: false
    }
  },
  {
    id: "agent-plan",
    title: "Agent plan",
    description: "Plan an agent run before tools or writes are used.",
    schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        steps: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              intent: { type: "string", enum: ["search", "read", "edit", "write", "answer", "test", "other"] },
              tool: { type: "string" },
              risk: { type: "string", enum: ["low", "medium", "high"] },
              needsApproval: { type: "boolean" }
            },
            required: ["title", "intent", "risk"],
            additionalProperties: false
          }
        },
        warnings: {
          type: "array",
          items: { type: "string" }
        },
        requiresApproval: { type: "boolean" }
      },
      required: ["summary", "steps", "requiresApproval"],
      additionalProperties: false
    }
  }
];

function listStructuredOutputSchemas() {
  return STRUCTURED_OUTPUT_SCHEMAS.map((item) => ({
    ...item,
    schema: clone(item.schema)
  }));
}

function selectStructuredOutputSchema(input = {}) {
  const custom = input.schema || input.outputSchema;
  if (custom && typeof custom === "object" && !Array.isArray(custom)) {
    const id = safeSchemaId(input.schemaId || input.name || "custom");
    return {
      id,
      title: String(input.title || id),
      description: String(input.description || "Custom structured output schema."),
      schema: clone(custom)
    };
  }

  const id = safeSchemaId(input.schemaId || input.id || "task-list");
  const found = STRUCTURED_OUTPUT_SCHEMAS.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Unknown structured output schema: ${id}`);
  }
  return {
    ...found,
    schema: clone(found.schema)
  };
}

function parseStructuredJson(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const candidates = [cleaned];
  for (const [open, close] of [["{", "}"], ["[", "]"]]) {
    const first = cleaned.indexOf(open);
    const last = cleaned.lastIndexOf(close);
    if (first !== -1 && last > first) {
      candidates.push(cleaned.slice(first, last + 1));
    }
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Keep trying trimmed candidates.
    }
  }
  throw new Error("Model response was not valid JSON.");
}

function validateStructuredOutput(value, schema, path = "$") {
  const errors = [];
  validateValue(value, schema || {}, path, errors);
  return { ok: errors.length === 0, errors };
}

function structuredOutputMessage(result = {}) {
  const descriptor = result.outputSchema || {};
  const title = descriptor.title || descriptor.id || "the selected schema";
  if (result.ok) {
    return `Structured output matched ${title}.`;
  }

  const errors = result.validation && Array.isArray(result.validation.errors) ? result.validation.errors : [];
  if (result.reason === "invalid-json") {
    return "The model did not return valid JSON. Try again or use a stricter local model.";
  }
  if (result.reason === "schema-violation" && errors.length) {
    return `The model returned JSON, but it did not match ${title}: ${errors.slice(0, 3).join(" ")}`;
  }
  return `The model response did not match ${title}.`;
}

function validateValue(value, schema, path, errors) {
  if (!schema || typeof schema !== "object") {
    return;
  }

  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${path} must be ${Array.isArray(schema.type) ? schema.type.join(" or ") : schema.type}.`);
    return;
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`${path} must be one of: ${schema.enum.join(", ")}.`);
  }

  if (schema.type === "object" || (schema.properties && isPlainObject(value))) {
    validateObject(value, schema, path, errors);
  }

  if (schema.type === "array" || (schema.items && Array.isArray(value))) {
    validateArray(value, schema, path, errors);
  }
}

function validateObject(value, schema, path, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be object.`);
    return;
  }

  const properties = schema.properties || {};
  for (const key of schema.required || []) {
    if (value[key] === undefined || value[key] === null) {
      errors.push(`${path}.${key} is required.`);
    }
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) {
        errors.push(`${path}.${key} is not allowed.`);
      }
    }
  }

  for (const [key, childSchema] of Object.entries(properties)) {
    if (value[key] !== undefined && value[key] !== null) {
      validateValue(value[key], childSchema, `${path}.${key}`, errors);
    }
  }
}

function validateArray(value, schema, path, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be array.`);
    return;
  }
  if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
    errors.push(`${path} must contain at least ${schema.minItems} item(s).`);
  }
  if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) {
    errors.push(`${path} must contain at most ${schema.maxItems} item(s).`);
  }
  if (schema.items) {
    value.forEach((item, index) => validateValue(item, schema.items, `${path}[${index}]`, errors));
  }
}

function matchesType(value, type) {
  if (Array.isArray(type)) {
    return type.some((item) => matchesType(value, item));
  }
  if (type === "array") return Array.isArray(value);
  if (type === "object") return isPlainObject(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "string") return typeof value === "string";
  if (type === "boolean") return typeof value === "boolean";
  if (type === "null") return value === null;
  return true;
}

function safeSchemaId(value) {
  return String(value || "custom")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "custom";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  listStructuredOutputSchemas,
  selectStructuredOutputSchema,
  parseStructuredJson,
  validateStructuredOutput,
  structuredOutputMessage
};
