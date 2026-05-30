"use strict";

const TOOL_SCHEMAS = [
  {
    name: "list_files",
    description: "List workspace-relative files with size and modified time.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "search_workspace",
    description: "Search local workspace files for relevant snippets before answering.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search terms to find in the workspace."
        },
        limit: {
          type: "number",
          description: "Maximum number of search results to return.",
          minimum: 1,
          maximum: 20
        }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "read_file",
    description: "Read one workspace-relative text file.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Workspace-relative file path."
        }
      },
      required: ["path"],
      additionalProperties: false
    }
  },
  {
    name: "preview_write_file",
    description: "Preview a complete file write as a unified diff without changing disk.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Workspace-relative file path."
        },
        content: {
          type: "string",
          description: "Complete new file content."
        }
      },
      required: ["path", "content"],
      additionalProperties: false
    }
  },
  {
    name: "write_file",
    description: "Write a complete file when write permission is enabled. Preview mode converts this into a diff.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Workspace-relative file path."
        },
        content: {
          type: "string",
          description: "Complete new file content."
        },
        approved: {
          type: "boolean",
          description: "True only when the user explicitly approved this high-risk write."
        }
      },
      required: ["path", "content"],
      additionalProperties: false
    }
  }
];

function listToolSchemas() {
  return TOOL_SCHEMAS.map((schema) => ({
    ...schema,
    parameters: clone(schema.parameters)
  }));
}

function toolDefinitionsForBackend(backend = "ollama") {
  return TOOL_SCHEMAS.map((schema) => ({
    type: "function",
    function: {
      name: schema.name,
      description: schema.description,
      parameters: clone(schema.parameters)
    }
  }));
}

function validateToolArguments(toolName, args = {}) {
  const schema = TOOL_SCHEMAS.find((item) => item.name === toolName);
  if (!schema) {
    return { ok: false, errors: [`Unknown tool: ${toolName}`] };
  }
  return validateObject(args && typeof args === "object" ? args : {}, schema.parameters, toolName);
}

function repairToolArguments(toolName, args = {}) {
  const repaired = { ...(args && typeof args === "object" && !Array.isArray(args) ? args : {}) };

  if (toolName === "search_workspace") {
    if (repaired.query === undefined) {
      repaired.query = firstDefined(repaired.q, repaired.term, repaired.terms, repaired.search, repaired.text);
    }
    if (typeof repaired.query !== "string" && repaired.query !== undefined) {
      repaired.query = String(repaired.query);
    }
    if (repaired.limit !== undefined) {
      const limit = Number(repaired.limit);
      if (Number.isFinite(limit)) {
        repaired.limit = Math.max(1, Math.min(20, limit));
      }
    }
    return keepAllowed(toolName, repaired);
  }

  if (["read_file", "preview_write_file", "write_file"].includes(toolName)) {
    if (repaired.path === undefined) {
      repaired.path = firstDefined(repaired.file, repaired.filename, repaired.filePath, repaired.relativePath, repaired.name);
    }
    if (typeof repaired.path !== "string" && repaired.path !== undefined) {
      repaired.path = String(repaired.path);
    }
  }

  if (["preview_write_file", "write_file"].includes(toolName)) {
    if (repaired.content === undefined) {
      repaired.content = firstDefined(repaired.text, repaired.body, repaired.value, repaired.contents, repaired.newContent);
    }
    if (typeof repaired.content !== "string" && repaired.content !== undefined) {
      repaired.content = String(repaired.content);
    }
  }

  return keepAllowed(toolName, repaired);
}

function formatToolSchemaPrompt() {
  return TOOL_SCHEMAS.map((schema) => {
    const example = exampleArguments(schema);
    return [
      `- ${schema.name}: ${schema.description}`,
      `  JSON: ${JSON.stringify({ tool: schema.name, arguments: example })}`
    ].join("\n");
  }).join("\n");
}

function exampleArguments(schema) {
  if (schema.name === "search_workspace") return { query: "search terms", limit: 5 };
  if (schema.name === "read_file") return { path: "relative/path.txt" };
  if (schema.name === "preview_write_file" || schema.name === "write_file") {
    return { path: "relative/path.txt", content: "complete file content" };
  }
  return {};
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function keepAllowed(toolName, args) {
  const schema = TOOL_SCHEMAS.find((item) => item.name === toolName);
  if (!schema || !schema.parameters || !schema.parameters.properties) {
    return args;
  }
  const allowed = new Set(Object.keys(schema.parameters.properties));
  const cleaned = {};
  for (const [key, value] of Object.entries(args)) {
    if (allowed.has(key)) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function validateObject(value, schema, label) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: [`${label} arguments must be an object.`] };
  }

  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const key of required) {
    if (value[key] === undefined || value[key] === null || value[key] === "") {
      errors.push(`${label}.${key} is required.`);
    }
  }

  const properties = schema.properties || {};
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) {
        errors.push(`${label}.${key} is not an allowed argument.`);
      }
    }
  }

  for (const [key, property] of Object.entries(properties)) {
    if (value[key] === undefined || value[key] === null) continue;
    const actual = Array.isArray(value[key]) ? "array" : typeof value[key];
    if (property.type && actual !== property.type) {
      errors.push(`${label}.${key} must be ${property.type}, got ${actual}.`);
      continue;
    }
    if (property.type === "string" && !value[key].trim()) {
      errors.push(`${label}.${key} cannot be empty.`);
    }
    if (property.type === "number") {
      if (Number.isNaN(value[key])) {
        errors.push(`${label}.${key} must be a valid number.`);
      }
      if (typeof property.minimum === "number" && value[key] < property.minimum) {
        errors.push(`${label}.${key} must be >= ${property.minimum}.`);
      }
      if (typeof property.maximum === "number" && value[key] > property.maximum) {
        errors.push(`${label}.${key} must be <= ${property.maximum}.`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  TOOL_SCHEMAS,
  listToolSchemas,
  toolDefinitionsForBackend,
  validateToolArguments,
  repairToolArguments,
  formatToolSchemaPrompt
};
