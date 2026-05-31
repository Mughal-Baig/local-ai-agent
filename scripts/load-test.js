#!/usr/bin/env node
// T086 — local load-test harness. Fires N concurrent requests at an AgentTrail
// endpoint and reports throughput + latency (avg/p95). No external deps.
// Usage: AGENTTRAIL_URL=http://127.0.0.1:4173 node scripts/load-test.js [path] [concurrency] [total]
const base = process.env.AGENTTRAIL_URL || "http://127.0.0.1:4173";
const pathArg = process.argv[2] || "/api/health";
const concurrency = Number(process.argv[3] || 10);
const total = Number(process.argv[4] || 200);

async function main() {
  const latencies = [];
  let done = 0, ok = 0, fail = 0;
  async function worker() {
    while (done < total) {
      done += 1;
      const t0 = Date.now();
      try { const r = await fetch(base + pathArg); (r.ok ? ok++ : fail++); }
      catch { fail++; }
      latencies.push(Date.now() - t0);
    }
  }
  const start = Date.now();
  await Promise.all(Array.from({ length: concurrency }, worker));
  const elapsed = (Date.now() - start) / 1000;
  latencies.sort((a, b) => a - b);
  const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  console.log(`load-test ${pathArg} c=${concurrency} n=${total}`);
  console.log(`ok=${ok} fail=${fail}  rps=${(total / elapsed).toFixed(1)}  avg=${avg}ms  p95=${p95}ms`);
}
main().catch((e) => { console.error(e); process.exit(1); });
