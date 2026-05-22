FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/payment-service/package*.json ./packages/payment-service/
RUN npm ci --workspace=packages/shared --workspace=packages/payment-service
COPY packages/shared ./packages/shared
COPY packages/payment-service ./packages/payment-service
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/payment-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/payment-service/dist ./packages/payment-service/dist
COPY --from=builder /app/packages/payment-service/package.json ./packages/payment-service/
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3004
CMD ["node", "packages/payment-service/dist/index.js"]
