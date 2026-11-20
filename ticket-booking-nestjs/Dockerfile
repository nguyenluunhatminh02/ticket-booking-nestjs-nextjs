FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts nest-cli.json ./
COPY tsconfig*.json ./
COPY src ./src

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
# The one-shot migrate service runs `prisma migrate deploy` in this image,
# so the schema and config must exist in the runner stage.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/generated /tmp/generated
RUN cp -rn /tmp/generated/. ./dist/generated/ && rm -rf /tmp/generated && mkdir -p uploads

EXPOSE 3001
CMD ["node", "dist/src/main"]
