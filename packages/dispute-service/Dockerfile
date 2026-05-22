FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/dispute-service/package*.json ./packages/dispute-service/
RUN npm ci --workspace=packages/shared --workspace=packages/dispute-service
COPY packages/shared ./packages/shared
COPY packages/dispute-service ./packages/dispute-service
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/dispute-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/dispute-service/dist ./packages/dispute-service/dist
COPY --from=builder /app/packages/dispute-service/package.json ./packages/dispute-service/
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3009
CMD ["node", "packages/dispute-service/dist/index.js"]
