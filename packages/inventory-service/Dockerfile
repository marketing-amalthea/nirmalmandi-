FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/inventory-service/package*.json ./packages/inventory-service/
RUN npm ci --workspace=packages/shared --workspace=packages/inventory-service
COPY packages/shared ./packages/shared
COPY packages/inventory-service ./packages/inventory-service
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/inventory-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/inventory-service/dist ./packages/inventory-service/dist
COPY --from=builder /app/packages/inventory-service/package.json ./packages/inventory-service/
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3002
CMD ["node", "packages/inventory-service/dist/index.js"]
