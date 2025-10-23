FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY src ./src
COPY data ./data
ENV PORT=4000
EXPOSE 4000
CMD ["npm","start"]
