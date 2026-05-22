FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/notification-service/package*.json ./packages/notification-service/
RUN npm ci --workspace=packages/shared --workspace=packages/notification-service
COPY packages/shared ./packages/shared
COPY packages/notification-service ./packages/notification-service
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/notification-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/notification-service/dist ./packages/notification-service/dist
COPY --from=builder /app/packages/notification-service/package.json ./packages/notification-service/
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3005
CMD ["node", "packages/notification-service/dist/index.js"]
