FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/auth-service/package*.json ./packages/auth-service/
RUN npm ci --workspace=packages/shared --workspace=packages/auth-service
COPY packages/shared ./packages/shared
COPY packages/auth-service ./packages/auth-service
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/auth-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/auth-service/dist ./packages/auth-service/dist
COPY --from=builder /app/packages/auth-service/package.json ./packages/auth-service/
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "packages/auth-service/dist/index.js"]
