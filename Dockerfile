FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json .
RUN npm install

ARG VITE_TENANT_BASE_DOMAIN
ARG VITE_TENANT_SLUG
ARG VITE_API_BASE_URL
ENV VITE_TENANT_BASE_DOMAIN=$VITE_TENANT_BASE_DOMAIN
ENV VITE_TENANT_SLUG=$VITE_TENANT_SLUG
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY ./tsconfig.json ./tsconfig.json
COPY ./vite.config.ts ./vite.config.ts
COPY ./index.html ./index.html
COPY ./public ./public
COPY ./src ./src

RUN npm run build

# Public landing page (separate Vite + Tailwind app in ./landing), served at "/".
FROM node:20-alpine AS landing-builder

WORKDIR /landing
COPY landing/package*.json ./
RUN npm ci

COPY landing/index.html landing/vite.config.ts landing/postcss.config.mjs ./
COPY landing/public ./public
COPY landing/src ./src

RUN npm run build

FROM nginx:1.27-alpine
COPY --from=landing-builder /landing/dist /usr/share/nginx/html
COPY --from=builder /app/dist /usr/share/nginx/html/bms
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
