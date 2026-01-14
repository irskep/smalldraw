FROM oven/bun:1-alpine

WORKDIR /usr/src/app

COPY package.json bun.lock ./
COPY prisma ./prisma/

RUN bun install --frozen-lockfile
RUN bunx prisma generate

COPY . .

EXPOSE $PORT

CMD ["bun", "run", "start"]
