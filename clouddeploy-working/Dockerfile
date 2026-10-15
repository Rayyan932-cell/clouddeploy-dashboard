FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json server.js index.html ./
EXPOSE 10000
USER node
CMD ["node", "server.js"]
