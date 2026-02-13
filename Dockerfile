FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY backend-express ./backend-express
RUN cd backend-express && npx tsc

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/backend-express/dist ./backend-express/dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "backend-express/dist/servers.js"]
