FROM oven/bun:1-alpine

WORKDIR /usr/src/app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

EXPOSE $PORT

CMD ["bun", "run", "start"]
