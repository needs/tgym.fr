# This file is generated by Nx.
#
# Build the docker image with `npx nx docker-build hocuspocus`.
# Tip: Modify "docker-build" options in project.json to change docker build args.
#
# Run the container with `docker run -p 4200:4200 -t hocuspocus`.
FROM docker.io/node:20-alpine

ENV HOST=0.0.0.0
ENV PORT=1234

WORKDIR /app

RUN addgroup --system hocuspocus && \
          adduser --system -G hocuspocus hocuspocus

COPY dist/apps/hocuspocus hocuspocus
RUN chown -R hocuspocus:hocuspocus .

# You can remove this install step if you build with `--bundle` option.
# The bundled output will include external dependencies.
RUN npm --prefix hocuspocus --omit=dev -f install

COPY libs/prisma/prisma/schema.prisma hocuspocus/prisma/schema.prisma
RUN cd hocuspocus && npx prisma generate

CMD [ "node", "hocuspocus" ]
