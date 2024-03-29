import { Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { Logger } from "@hocuspocus/extension-logger";
import { getRole, getUser } from '@tgym.fr/auth';
import { prisma } from './prisma';
import { adminApp } from './firebase';
import { competitionSchema } from '@tgym.fr/core';
import * as Y from 'yjs'

function getPort() {
  const port = process.env['PORT'];
  if (port === undefined) {
    return 1234;
  }
  return parseInt(port, 10);
}

const server = new Hocuspocus({
  timeout: 60000,

  async onAuthenticate(data) {
    const { token: idToken, documentName } = data;

    console.time('getUser');
    const user = await getUser(adminApp, prisma, idToken);
    console.timeEnd('getUser');

    if (user === undefined) {
      data.connection.readOnly = true;
      return;
    }

    console.time('getRole');
    const role = await getRole(prisma, documentName, user);
    console.timeEnd('getRole');

    if (role !== 'EDITOR' && role !== 'OWNER') {
      data.connection.readOnly = true;
      return;
    }
  },

  async afterLoadDocument({ document }) {
    const defaultCompetition = competitionSchema.parse({});

    Object.keys(defaultCompetition).forEach((key) => {
      if (!document.getMap('competition').has(key)) {
        document.getMap('competition').set(key, new Y.Map());
      }
    });
  },

  extensions: [
    new Logger(),
    new Database({
      fetch: async ({ documentName }) => {
        const competition = await prisma.competition.update({
          where: {
            uuid: documentName,
            deletedAt: null,
          },
          data: {
            viewCount: {
              increment: 1,
            }
          },
          select: {
            data: true,
          }
        });

        if (competition === null) {
          throw new Error('Competition not found');
        }

        return Uint8Array.from(competition.data);
      },
      store: async ({ documentName, state, document }) => {
        const competition = competitionSchema.parse(
          document.getMap('competition').toJSON()
        );

        const teamCount = Object.values(competition.teams).length;
        const playerCount = Object.values(competition.players).length;
        const cumulativeDuration = Object.values(competition.schedules)
          .map((schedule) =>
            Object.values(schedule.events).map(
              (event) => event.durationInMinutes
            )
          )
          .flat()
          .reduce((a, b) => a + b, 0);

        const name = competition.info.name;

        await prisma.competition.update({
          where: {
            uuid: documentName,
            deletedAt: null,
          },
          data: {
            data: state,
            name,
            teamCount,
            playerCount,
            cumulativeDuration,
          },
        });
      },
    }),
  ],
  port: getPort(),
});

// Temporary, for debugging weird latency on first connect.
server.enableMessageLogging();

server.listen();
