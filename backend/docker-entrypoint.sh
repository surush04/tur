#!/bin/sh
set -eu

echo "Waiting for PostgreSQL..."
until node -e "const {Client}=require('pg'); const c=new Client({connectionString:process.env.DATABASE_URL}); c.connect().then(()=>c.end()).then(()=>process.exit(0)).catch(()=>process.exit(1))"; do
  sleep 2
done

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Starting API..."
exec node dist/main.js
