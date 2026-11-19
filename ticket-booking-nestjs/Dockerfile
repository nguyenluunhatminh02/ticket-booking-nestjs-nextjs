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
COPY --from=builder /app/generated /tmp/generated
RUN cp -rn /tmp/generated/. ./dist/generated/ && rm -rf /tmp/generated && mkdir -p uploads

EXPOSE 3001
CMD ["node", "dist/src/main"]
