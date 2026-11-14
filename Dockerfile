FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared-schemas/package.json ./packages/shared-schemas/
COPY apps/api/package.json ./apps/api/
COPY apps/web-components/package.json ./apps/web-components/
RUN pnpm install --frozen-lockfile=false
COPY . .
RUN pnpm build:schemas && pnpm -F @db/web-components build && pnpm -F @db/api build
EXPOSE 3000 5173
CMD ["pnpm", "dev"]
