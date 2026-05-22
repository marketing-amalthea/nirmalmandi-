FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/analytics-service/package*.json ./packages/analytics-service/
RUN npm ci --workspace=packages/shared --workspace=packages/analytics-service
COPY packages/shared ./packages/shared
COPY packages/analytics-service ./packages/analytics-service
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/analytics-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/analytics-service/dist ./packages/analytics-service/dist
COPY --from=builder /app/packages/analytics-service/package.json ./packages/analytics-service/
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3008
CMD ["node", "packages/analytics-service/dist/index.js"]
