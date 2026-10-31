FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN sed -i 's/\r$//' docker-entrypoint.sh \
  && chmod +x docker-entrypoint.sh

ENV DATABASE_URL=postgresql://rohi:rohi_dev_password@postgres:5432/rohi_travel
RUN npx prisma generate && npm run build

ENV HOST=0.0.0.0
ENV PORT=3010
EXPOSE 3010

ENTRYPOINT ["./docker-entrypoint.sh"]
