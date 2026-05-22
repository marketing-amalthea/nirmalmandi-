FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/logistics-service/package*.json ./packages/logistics-service/
RUN npm ci --workspace=packages/shared --workspace=packages/logistics-service
COPY packages/shared ./packages/shared
COPY packages/logistics-service ./packages/logistics-service
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/logistics-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/logistics-service/dist ./packages/logistics-service/dist
COPY --from=builder /app/packages/logistics-service/package.json ./packages/logistics-service/
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3007
CMD ["node", "packages/logistics-service/dist/index.js"]
