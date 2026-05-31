"use strict";

const crypto = require("node:crypto");
const { redactValueOnly } = require("./privacy");
const { classifyError, ERROR_TAXONOMY } = require("./features/errors");

function createObservability(options = {}) {
  return new ObservabilityTracker(options);
}

class ObservabilityTracker {
  constructor(options = {}) {
    this.startedAt = new Date().toISOString();
    this.maxTraces = positiveInt(options.maxTraces, 80);
    this.maxTraceEvents = positiveInt(options.maxTraceEvents, 120);
    this.maxErrors = positiveInt(options.maxErrors, 80);
    this.active = new Map();
    this.traces = [];
    this.errors = [];
    this.metrics = {
      runsStarted: 0,
      runsCompleted: 0,
      runsFailed: 0,
      runsCancelled: 0,
      recipesStarted: 0,
      recipesCompleted: 0,
      recipesFailed: 0,
      toolCallsTotal: 0,
      tokenEvents: 0,
      outputCharacters: 0,
      outputTokens: 0,
      inputCharacters: 0,
      inputTokens: 0,
      latencySamples: [],
      errorsTotal: 0,
      errorsByCode: {}
    };
  }

  startTrace(kind = "run", metadata = {}) {
    const trace = {
      schema: "agenttrail.trace.v1",
      id: traceId(kind),
      kind,
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      durationMs: null,
      metadata: redactValueOnly(metadata || {}),
      counters: {
        inputCharacters: 0,
        inputTokens: 0,
        outputCharacters: 0,
        outputTokens: 0,
        tokenEvents: 0,
        toolCalls: 0,
        errors: 0
      },
      events: []
    };
    this.active.set(trace.id, trace);
    this.metrics.runsStarted += 1;
    if (kind === "recipe") {
      this.metrics.recipesStarted += 1;
    }
    this.recordEvent(trace, "trace", `${kind} started`, { kind });
    return trace;
  }

  updateTrace(traceOrId, metadata = {}) {
    const trace = this.resolveTrace(traceOrId);
    if (!trace) return null;
    trace.metadata = redactValueOnly({ ...trace.metadata, ...metadata });
    return trace;
  }

  recordInput(traceOrId, text) {
    const trace = this.resolveTrace(traceOrId);
    if (!trace) return null;
    const characters = String(text || "").length;
    const tokens = estimateTokensFromChars(characters);
    trace.counters.inputCharacters += characters;
    trace.counters.inputTokens = estimateTokensFromChars(trace.counters.inputCharacters);
    this.metrics.inputCharacters += characters;
    this.metrics.inputTokens += tokens;
    return trace.counters;
  }

  recordToken(traceOrId, text) {
    const trace = this.resolveTrace(traceOrId);
    if (!trace) return null;
    const characters = String(text || "").length;
    trace.counters.outputCharacters += characters;
    trace.counters.outputTokens = estimateTokensFromChars(trace.counters.outputCharacters);
    trace.counters.tokenEvents += 1;
    this.metrics.outputCharacters += characters;
    this.metrics.outputTokens += estimateTokensFromChars(characters);
    this.metrics.tokenEvents += 1;
    return trace.counters;
  }

  recordTool(traceOrId, toolName, fields = {}) {
    const trace = this.resolveTrace(traceOrId);
    if (!trace) return null;
    trace.counters.toolCalls += 1;
    this.metrics.toolCallsTotal += 1;
    return this.recordEvent(trace, "tool", String(toolName || "tool"), fields);
  }

  recordEvent(traceOrId, type, label, fields = {}) {
    const trace = this.resolveTrace(traceOrId);
    if (!trace) return null;
    const event = {
      time: new Date().toISOString(),
      type: String(type || "event"),
      label: truncate(String(label || type || "event"), 180),
      fields: redactValueOnly(limitObject(fields))
    };
    trace.events.push(event);
    if (trace.events.length > this.maxTraceEvents) {
      trace.events = trace.events.slice(-this.maxTraceEvents);
    }
    return event;
  }

  recordError(error, context = {}, traceOrId = null) {
    const classified = classifyError(error, context);
    this.metrics.errorsTotal += 1;
    this.metrics.errorsByCode[classified.code] = (this.metrics.errorsByCode[classified.code] || 0) + 1;
    const entry = {
      schema: "agenttrail.error.v1",
      time: new Date().toISOString(),
      ...classified,
      route: context.route || null,
      traceId: context.traceId || (traceOrId && this.resolveTrace(traceOrId)?.id) || null,
      status: context.status || error?.status || null
    };
    this.errors.unshift(redactValueOnly(entry));
    this.errors = this.errors.slice(0, this.maxErrors);
    const trace = this.resolveTrace(traceOrId);
    if (trace) {
      trace.counters.errors += 1;
      this.recordEvent(trace, "error", classified.code, {
        category: classified.category,
        severity: classified.severity,
        action: classified.action
      });
    }
    return entry;
  }

  finishTrace(traceOrId, status = "ok", fields = {}) {
    const trace = this.resolveTrace(traceOrId);
    if (!trace) return null;
    if (trace.finishedAt) return trace;
    trace.status = status;
    trace.finishedAt = new Date().toISOString();
    trace.durationMs = Math.max(0, Date.parse(trace.finishedAt) - Date.parse(trace.startedAt));
    trace.counters.outputTokens = estimateTokensFromChars(trace.counters.outputCharacters);
    trace.counters.inputTokens = estimateTokensFromChars(trace.counters.inputCharacters);
    this.metrics.latencySamples.push(trace.durationMs);
    this.metrics.latencySamples = this.metrics.latencySamples.slice(-250);
    if (status === "ok") {
      this.metrics.runsCompleted += 1;
      if (trace.kind === "recipe") this.metrics.recipesCompleted += 1;
    } else if (status === "cancelled") {
      this.metrics.runsCancelled += 1;
    } else {
      this.metrics.runsFailed += 1;
      if (trace.kind === "recipe") this.metrics.recipesFailed += 1;
    }
    this.recordEvent(trace, "finish", `${trace.kind} ${status}`, {
      durationMs: trace.durationMs,
      inputTokens: trace.counters.inputTokens,
      outputTokens: trace.counters.outputTokens,
      ...fields
    });
    this.active.delete(trace.id);
    this.traces.unshift(trace);
    this.traces = this.traces.slice(0, this.maxTraces);
    return trace;
  }

  resolveTrace(traceOrId) {
    if (!traceOrId) return null;
    if (typeof traceOrId === "object" && traceOrId.id) return traceOrId;
    return this.active.get(String(traceOrId)) || this.traces.find((trace) => trace.id === String(traceOrId)) || null;
  }

  traceDetail(id) {
    const trace = this.resolveTrace(id);
    return trace ? cloneTrace(trace) : null;
  }

  traceSummaries(limit = 24) {
    const active = Array.from(this.active.values());
    return [...active, ...this.traces]
      .slice(0, Math.max(1, limit))
      .map(traceSummary);
  }

  snapshot() {
    const latency = summarizeLatency(this.metrics.latencySamples);
    return {
      schema: "agenttrail.observability.v1",
      startedAt: this.startedAt,
      activeRuns: this.active.size,
      totals: {
        runsStarted: this.metrics.runsStarted,
        runsCompleted: this.metrics.runsCompleted,
        runsFailed: this.metrics.runsFailed,
        runsCancelled: this.metrics.runsCancelled,
        recipesStarted: this.metrics.recipesStarted,
        recipesCompleted: this.metrics.recipesCompleted,
        recipesFailed: this.metrics.recipesFailed,
        toolCalls: this.metrics.toolCallsTotal,
        tokenEvents: this.metrics.tokenEvents,
        inputTokens: estimateTokensFromChars(this.metrics.inputCharacters),
        outputTokens: estimateTokensFromChars(this.metrics.outputCharacters),
        errors: this.metrics.errorsTotal
      },
      latency,
      errorsByCode: { ...this.metrics.errorsByCode },
      recentErrors: this.errors.slice(0, 12),
      traces: this.traceSummaries(24)
    };
  }

  analytics() {
    const traces = [...this.traces, ...Array.from(this.active.values())];
    const byKind = {};
    const byStatus = {};
    for (const trace of traces) {
      byKind[trace.kind] = (byKind[trace.kind] || 0) + 1;
      byStatus[trace.status] = (byStatus[trace.status] || 0) + 1;
    }
    return {
      schema: "agenttrail.local-analytics.v1",
      privacy: "aggregate-only; prompts, file contents, diffs, and token text are not included",
      totals: this.snapshot().totals,
      byKind,
      byStatus,
      latency: summarizeLatency(this.metrics.latencySamples),
      errorsByCode: { ...this.metrics.errorsByCode },
      recentTraceIds: this.traceSummaries(10).map((trace) => trace.id)
    };
  }

  prometheus() {
    const snapshot = this.snapshot();
    const lines = [
      "# HELP agenttrail_runs_started_total AgentTrail runs started.",
      "# TYPE agenttrail_runs_started_total counter",
      `agenttrail_runs_started_total ${snapshot.totals.runsStarted}`,
      "# HELP agenttrail_runs_completed_total AgentTrail runs completed successfully.",
      "# TYPE agenttrail_runs_completed_total counter",
      `agenttrail_runs_completed_total ${snapshot.totals.runsCompleted}`,
      "# HELP agenttrail_runs_failed_total AgentTrail runs failed.",
      "# TYPE agenttrail_runs_failed_total counter",
      `agenttrail_runs_failed_total ${snapshot.totals.runsFailed}`,
      "# HELP agenttrail_runs_cancelled_total AgentTrail runs cancelled by the user.",
      "# TYPE agenttrail_runs_cancelled_total counter",
      `agenttrail_runs_cancelled_total ${snapshot.totals.runsCancelled}`,
      "# HELP agenttrail_active_runs AgentTrail runs currently active.",
      "# TYPE agenttrail_active_runs gauge",
      `agenttrail_active_runs ${snapshot.activeRuns}`,
      "# HELP agenttrail_output_tokens_total Estimated output tokens streamed by local runs.",
      "# TYPE agenttrail_output_tokens_total counter",
      `agenttrail_output_tokens_total ${snapshot.totals.outputTokens}`,
      "# HELP agenttrail_input_tokens_total Estimated input tokens sent into local runs.",
      "# TYPE agenttrail_input_tokens_total counter",
      `agenttrail_input_tokens_total ${snapshot.totals.inputTokens}`,
      "# HELP agenttrail_tool_calls_total Local tool calls observed.",
      "# TYPE agenttrail_tool_calls_total counter",
      `agenttrail_tool_calls_total ${snapshot.totals.toolCalls}`,
      "# HELP agenttrail_latency_ms Summary of completed run latency in milliseconds.",
      "# TYPE agenttrail_latency_ms summary",
      `agenttrail_latency_ms{quantile="0.50"} ${snapshot.latency.p50Ms}`,
      `agenttrail_latency_ms{quantile="0.95"} ${snapshot.latency.p95Ms}`,
      `agenttrail_latency_ms_sum ${snapshot.latency.sumMs}`,
      `agenttrail_latency_ms_count ${snapshot.latency.count}`,
      "# HELP agenttrail_errors_total Errors classified by AgentTrail taxonomy.",
      "# TYPE agenttrail_errors_total counter"
    ];
    for (const [code, count] of Object.entries(snapshot.errorsByCode)) {
      lines.push(`agenttrail_errors_total{code="${escapeLabel(code)}"} ${count}`);
    }
    if (!Object.keys(snapshot.errorsByCode).length) {
      lines.push("agenttrail_errors_total{code=\"none\"} 0");
    }
    return `${lines.join("\n")}\n`;
  }
}

function estimateTokens(text) {
  return estimateTokensFromChars(String(text || "").length);
}

function estimateTokensFromChars(chars) {
  const size = Number(chars || 0);
  if (size <= 0) return 0;
  return Math.max(1, Math.ceil(size / 4));
}

function traceSummary(trace) {
  return {
    id: trace.id,
    kind: trace.kind,
    status: trace.status,
    startedAt: trace.startedAt,
    finishedAt: trace.finishedAt,
    durationMs: trace.durationMs,
    metadata: redactValueOnly(trace.metadata || {}),
    counters: { ...trace.counters },
    lastEvent: trace.events.length ? trace.events[trace.events.length - 1] : null,
    eventCount: trace.events.length
  };
}

function cloneTrace(trace) {
  return {
    ...trace,
    metadata: redactValueOnly(trace.metadata || {}),
    counters: { ...trace.counters },
    events: trace.events.map((event) => ({ ...event, fields: redactValueOnly(event.fields || {}) }))
  };
}

function summarizeLatency(samples) {
  const sorted = samples.slice().sort((a, b) => a - b);
  const sum = sorted.reduce((total, item) => total + item, 0);
  return {
    count: sorted.length,
    sumMs: sum,
    avgMs: sorted.length ? Math.round(sum / sorted.length) : 0,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted.length ? sorted[sorted.length - 1] : 0
  };
}

function percentile(sorted, ratio) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function traceId(kind) {
  const prefix = String(kind || "run").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "run";
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
}

function truncate(value, max) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function limitObject(value) {
  if (!value || typeof value !== "object") return {};
  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, 16)) {
    if (typeof item === "string") {
      output[key] = truncate(item, 220);
    } else if (typeof item === "number" || typeof item === "boolean" || item == null) {
      output[key] = item;
    } else if (Array.isArray(item)) {
      output[key] = item.slice(0, 8).map((entry) => typeof entry === "string" ? truncate(entry, 120) : entry);
    } else {
      output[key] = truncate(JSON.stringify(item), 300);
    }
  }
  return output;
}

function escapeLabel(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

module.exports = {
  ERROR_TAXONOMY,
  ObservabilityTracker,
  createObservability,
  estimateTokens
};
