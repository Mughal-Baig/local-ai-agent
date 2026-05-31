# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22
FROM --platform=$TARGETPLATFORM node:${NODE_VERSION}-alpine AS runtime

ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG VERSION=0.7.0
ARG VCS_REF=local

LABEL org.opencontainers.image.title="AgentTrail" \
      org.opencontainers.image.description="Auditable local AI agent with Ollama, diff previews, receipts, and replay" \
      org.opencontainers.image.source="https://github.com/Mughal-Baig/local-ai-agent" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app
RUN addgroup -S agenttrail && adduser -S agenttrail -G agenttrail
COPY --chown=agenttrail:agenttrail . .
ENV PORT=4173
ENV HOST=0.0.0.0
ENV WORKSPACE_ROOT=/data/workspace
ENV NODE_ENV=production
RUN mkdir -p /data/workspace && chown -R agenttrail:agenttrail /data
USER agenttrail
VOLUME ["/data/workspace"]
EXPOSE 4173
CMD ["node", "server.js"]
