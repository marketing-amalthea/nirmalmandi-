FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/invoice-service/package*.json ./packages/invoice-service/
RUN npm ci --workspace=packages/shared --workspace=packages/invoice-service
COPY packages/shared ./packages/shared
COPY packages/invoice-service ./packages/invoice-service
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/invoice-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/invoice-service/dist ./packages/invoice-service/dist
COPY --from=builder /app/packages/invoice-service/package.json ./packages/invoice-service/
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3006
CMD ["node", "packages/invoice-service/dist/index.js"]
