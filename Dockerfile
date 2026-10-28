FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Easypanel enruta el dominio al puerto 80 del contenedor
ENV PORT=80
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 80
CMD ["node", "server/index.js"]
