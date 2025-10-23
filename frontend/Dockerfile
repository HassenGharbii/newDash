# Frontend Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
# Install with devDependencies (needed for Tailwind/Vite build)
RUN npm install
COPY . .
# Build static assets
RUN npm run build

# Serve build with Vite preview (simple & zero-config)
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=build /app /app
EXPOSE 5173
CMD ["npm","run","preview","--","--port","5173","--host"]
