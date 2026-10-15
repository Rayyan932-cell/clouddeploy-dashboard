FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json server.js index.html game.html premium.css ./
RUN npm install --omit=dev
EXPOSE 10000
USER node
CMD ["node", "server.js"]
