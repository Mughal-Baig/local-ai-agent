FROM node:22-alpine
WORKDIR /app
COPY . .
ENV PORT=4173
ENV WORKSPACE_ROOT=/app/workspace
EXPOSE 4173
CMD ["node", "server.js"]
