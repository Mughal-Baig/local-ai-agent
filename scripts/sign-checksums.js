#!/usr/bin/env node

"use strict";

const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");
const packageMeta = require("../package.json");

const projectRoot = path.resolve(__dirname, "..");
const checksumPath = path.join(projectRoot, "docs", "checksums", `SHA256SUMS_v${packageMeta.version}.txt`);
const signaturePath = `${checksumPath}.sig`;
const metadataPath = `${checksumPath}.sig.json`;

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const checksum = await fsp.readFile(checksumPath);
  const privateKeyPem = process.env.AGENTTRAIL_CHECKSUM_SIGNING_PRIVATE_KEY || "";
  if (!privateKeyPem) {
    if (!dryRun) {
      throw new Error("Set AGENTTRAIL_CHECKSUM_SIGNING_PRIVATE_KEY, or run with --dry-run.");
    }
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      checksumPath: path.relative(projectRoot, checksumPath),
      checksumSha256: sha256(checksum),
      requiredSecret: "AGENTTRAIL_CHECKSUM_SIGNING_PRIVATE_KEY"
    }, null, 2));
    return;
  }

  const key = crypto.createPrivateKey(privateKeyPem);
  const publicKey = crypto.createPublicKey(key).export({ type: "spki", format: "pem" });
  const algorithm = key.asymmetricKeyType === "ed25519" || key.asymmetricKeyType === "ed448" ? null : "sha256";
  const signature = crypto.sign(algorithm, checksum, key);
  await fsp.writeFile(signaturePath, `${signature.toString("base64")}\n`, "utf8");
  await fsp.writeFile(metadataPath, `${JSON.stringify({
    schema: "agenttrail.checksum-signature.v1",
    version: packageMeta.version,
    checksumPath: path.relative(projectRoot, checksumPath),
    checksumSha256: sha256(checksum),
    signaturePath: path.relative(projectRoot, signaturePath),
    algorithm: key.asymmetricKeyType || "unknown",
    publicKeySha256: sha256(Buffer.from(publicKey)),
    publicKey
  }, null, 2)}\n`, "utf8");
  console.log(`Signed ${path.relative(projectRoot, checksumPath)}`);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
