# Imagem node:20 (Debian bookworm completa) em vez de alpine/slim: o Prisma precisa
# de libssl para os query/schema engines, e so a variante completa ja traz OpenSSL 3.
# Alpine e slim exigiriam "apk add openssl" / "apt-get install openssl", que falham
# em redes corporativas onde o TLS e interceptado por proxy.
#
# Outras escolhas de proposito para o mesmo cenario:
#  - nao usamos "npx" (ele reconsulta o registry); chamamos os binarios locais
#    pelos scripts do package.json, que resolvem em node_modules/.bin;
#  - NODE_EXTRA_CA_CERTS e definido apenas nos passos de instalacao, com o bundle
#    de CAs do host montado via build context (scripts/export-corporate-ca.ps1).
#    Em rede sem proxy o bundle fica vazio e nada muda.

# ---------------------------------------------------------------- base
FROM node:20 AS base
WORKDIR /app
COPY package*.json ./

# ---------------------------------------------------------------- dev
FROM base AS development
ENV NODE_ENV=development
RUN --mount=type=bind,from=certs,target=/certs,ro \
    NODE_EXTRA_CA_CERTS=/certs/corporate-ca.pem npm install --no-audit --no-fund
COPY prisma ./prisma
RUN npm run prisma:generate
COPY . .
EXPOSE 3333
# migrate deploy + seed antes de subir a API com hot reload
CMD ["sh", "-c", "npm run prisma:deploy && npm run seed && npm run start:dev"]

# ---------------------------------------------------------------- build
FROM base AS build
ENV NODE_ENV=development
RUN --mount=type=bind,from=certs,target=/certs,ro \
    NODE_EXTRA_CA_CERTS=/certs/corporate-ca.pem npm install --no-audit --no-fund
COPY prisma ./prisma
RUN npm run prisma:generate
COPY . .
RUN npm run build

# ---------------------------------------------------------------- prod
FROM node:20 AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3333/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["sh", "-c", "npm run prisma:deploy && node dist/src/main"]
