FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY src ./src
COPY data ./data
ENV PORT=4000
EXPOSE 4000
CMD ["npm","start"]
