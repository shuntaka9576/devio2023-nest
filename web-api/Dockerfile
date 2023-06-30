FROM node:18-alpine3.17 AS build

ENV GRAPHQL_SCHEMA_PATH "./schema.graphql"

WORKDIR /app

COPY web-api/package.json ./
COPY package-lock.json ./

RUN npm ci

COPY schema.graphql ./
COPY web-api/tsconfig.build.json ./
COPY web-api/tsconfig.json ./
COPY web-api/schema.prisma ./
COPY web-api/.env ./
COPY web-api/src ./app

RUN npx prisma generate
RUN npm run build
RUN npm install --omit=dev

FROM node:18-alpine3.17

ENV PORT=80
ENV GRAPHQL_SCHEMA_PATH "./schema.graphql"

WORKDIR /app

COPY --from=build /app/dist /app/dist
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/schema.graphql /app/schema.graphql
COPY --from=build /app/.env /app/.env

EXPOSE 80
ENTRYPOINT [ "node" ]
CMD [ "dist/main.js" ]
