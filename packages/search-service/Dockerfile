FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/search-service/package*.json ./packages/search-service/
RUN npm ci --workspace=packages/shared --workspace=packages/search-service
COPY packages/shared ./packages/shared
COPY packages/search-service ./packages/search-service
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/search-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/search-service/dist ./packages/search-service/dist
COPY --from=builder /app/packages/search-service/package.json ./packages/search-service/
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3010
CMD ["node", "packages/search-service/dist/index.js"]
