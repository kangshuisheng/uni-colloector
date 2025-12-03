# Use the official Bun image
FROM oven/bun:1 as base
WORKDIR /app

# Install dependencies
# Copy package.json and bun.lockb (if exists)
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Run the application
# Using "start" script from package.json
CMD ["bun", "run", "start"]
