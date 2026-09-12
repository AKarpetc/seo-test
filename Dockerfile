FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy project files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

EXPOSE 3000
ENV PORT 3000

# Start the application
CMD ["npm", "start"]
