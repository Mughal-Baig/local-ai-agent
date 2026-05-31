"use strict";

const net = require("node:net");

function normalizeNetworkAllowlist(value, env = process.env) {
  const entries = [];
  if (Array.isArray(value)) {
    entries.push(...value);
  } else if (typeof value === "string") {
    entries.push(...value.split(/[,\s]+/));
  }
  if (env.AGENTTRAIL_EGRESS_ALLOWLIST) {
    entries.push(...String(env.AGENTTRAIL_EGRESS_ALLOWLIST).split(/[,\s]+/));
  }
  const normalized = entries.map((entry) => normalizeAllowlistHost(entry)).filter(Boolean);
  return [...new Set(normalized)].slice(0, 80);
}

function normalizeAllowlistHost(value) {
  let raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "*") return "*";
  try {
    raw = new URL(raw.includes("://") ? raw : `https://${raw}`).host.toLowerCase();
  } catch {
    raw = raw.replace(/^https?:\/\//, "").split("/")[0];
  }
  return raw.replace(/\.$/, "");
}

function validateNetworkEgress(rawUrl, options = {}) {
  let parsed;
  try {
    parsed = rawUrl instanceof URL ? rawUrl : new URL(String(rawUrl));
  } catch {
    throw policyError(400, "Network egress target must be a valid URL.");
  }

  if (parsed.protocol === "file:") {
    return {
      ok: true,
      url: parsed.href,
      host: "file",
      private: false,
      matchedAllowlist: "file",
      policy: "local-file"
    };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw policyError(400, "Network egress only supports http:// and https:// URLs.");
  }

  const env = options.env || process.env;
  const allowlist = normalizeNetworkAllowlist(options.allowlist, env);
  const privateHost = isPrivateNetworkHost(parsed.hostname);
  const allowPrivate = options.allowPrivate === true || String(env.AGENTTRAIL_EGRESS_ALLOW_PRIVATE || "false").toLowerCase() === "true";
  const requireAllowlist = options.requireAllowlist === true || String(env.AGENTTRAIL_REQUIRE_EGRESS_ALLOWLIST || "false").toLowerCase() === "true";

  if (privateHost && !allowPrivate) {
    throw policyError(403, "Private/local network egress requires an explicit allowPrivate flag or AGENTTRAIL_EGRESS_ALLOW_PRIVATE=true.");
  }

  let match = "";
  if (allowlist.length) {
    match = allowlist.find((entry) => hostMatchesAllowlist(parsed, entry)) || "";
    if (!match) {
      throw policyError(403, `Host ${parsed.host} is not in the network egress allowlist.`);
    }
  } else if (requireAllowlist) {
    throw policyError(403, "Network egress requires an explicit allowlist entry.");
  }

  return {
    ok: true,
    url: parsed.href,
    host: parsed.host,
    private: privateHost,
    matchedAllowlist: match || null,
    policy: allowlist.length ? "allowlist" : "default-public",
    purpose: options.purpose || "network-egress"
  };
}

function hostMatchesAllowlist(url, entry) {
  const allowed = normalizeAllowlistHost(entry);
  if (!allowed) return false;
  if (allowed === "*") return true;
  const host = url.host.toLowerCase().replace(/\.$/, "");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (allowed === host || allowed === hostname) {
    return true;
  }
  if (allowed.startsWith(".")) {
    return hostname.endsWith(allowed);
  }
  return !net.isIP(hostname) && hostname.endsWith(`.${allowed}`);
}

function isPrivateNetworkHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0") {
    return true;
  }
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const [a, b] = host.split(".").map((part) => Number(part));
    return a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168);
  }
  if (ipVersion === 6) {
    return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  }
  return false;
}

function policyError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function networkPolicyStatus(env = process.env) {
  return {
    schema: "agenttrail.network-policy.v1",
    allowlist: normalizeNetworkAllowlist("", env),
    requireAllowlist: String(env.AGENTTRAIL_REQUIRE_EGRESS_ALLOWLIST || "false").toLowerCase() === "true",
    allowPrivate: String(env.AGENTTRAIL_EGRESS_ALLOW_PRIVATE || "false").toLowerCase() === "true"
  };
}

module.exports = {
  normalizeNetworkAllowlist,
  normalizeAllowlistHost,
  validateNetworkEgress,
  hostMatchesAllowlist,
  isPrivateNetworkHost,
  networkPolicyStatus
};
