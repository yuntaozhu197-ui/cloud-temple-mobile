FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY app ./app
COPY public ./public
COPY index.html tsconfig.json vite.config.ts ./
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV TEMPLE_DATA_DIR=/app/data
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server.mjs ./server.mjs
COPY --chown=node:node temple-life.mjs ./temple-life.mjs
COPY --chown=node:node temple-auth.mjs ./temple-auth.mjs
COPY --chown=node:node temple-lamps.mjs ./temple-lamps.mjs
COPY --chown=node:node temple-lanterns.mjs ./temple-lanterns.mjs
COPY --chown=node:node pond-game.mjs ./pond-game.mjs
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
