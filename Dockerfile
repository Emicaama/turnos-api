FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openssl postgresql-client

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "PREPARE_STATUS_DIRECT=1 node scripts/prepare-appointment-status.cjs && npx prisma db push --skip-generate --accept-data-loss && node dist/seed.js && node dist/main.js"]
