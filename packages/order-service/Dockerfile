FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/order-service/package*.json ./packages/order-service/
RUN npm ci --workspace=packages/shared --workspace=packages/order-service
COPY packages/shared ./packages/shared
COPY packages/order-service ./packages/order-service
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/order-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/order-service/dist ./packages/order-service/dist
COPY --from=builder /app/packages/order-service/package.json ./packages/order-service/
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3003
CMD ["node", "packages/order-service/dist/index.js"]
