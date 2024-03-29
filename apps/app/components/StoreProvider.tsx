import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Competition, Store } from '../lib/store';
import { Box, CircularProgress } from '@mui/material';
import { UndoManager } from 'yjs';
import {
  HocuspocusProvider,
  onAwarenessUpdateParameters,
} from '@hocuspocus/provider';
import { useSyncedStore } from '@syncedstore/react';
import { trpc } from '../utils/trpc';
import syncedStore from '@syncedstore/core';
import { parseCookies } from 'nookies';
import { getUserName } from '../lib/avatar';

const context = createContext<
  | {
      store: Store;
      provider: HocuspocusProvider;
      undoManager: UndoManager;
      awareness: onAwarenessUpdateParameters | undefined;
    }
  | undefined
>(undefined);

const StoreProvider = ({
  children,
  competitionUuid,
}: {
  children: ReactNode;
  competitionUuid: string;
}) => {
  const [storeLoaded, setStoreLoaded] = useState(false);
  const [awareness, setAwareness] = useState<
    onAwarenessUpdateParameters | undefined
  >(undefined);
  const { data: user } = trpc.user.useQuery({ competitionUuid });

  const [{ provider, store, undoManager }] = useState(() => {
    const cookies = parseCookies();
    setStoreLoaded(false);

    const provider = new HocuspocusProvider({
      url: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL ?? 'ws://127.0.0.1:1234',
      name: competitionUuid,
      token: cookies.token || 'notoken',

      onAwarenessUpdate(awareness) {
        setAwareness(awareness);
      },
    });

    provider.on('synced', () => {
      setStoreLoaded(true);
    });

    const store = syncedStore<{ competition: Competition }>(
      {
        competition: {} as Competition,
      },
      provider.document
    );

    const undoManager = new UndoManager(
      provider.document.getMap('competition')
    );

    return {
      provider,
      store,
      undoManager,
    };
  });

  useEffect(() => {
    if (user !== undefined) {
      const name = getUserName(user.email, user.name ?? undefined);
      provider.setAwarenessField('user', { name });
    }
  }, [user, provider]);

  useEffect(() => {
    return () => {
      provider.destroy();
      undoManager.destroy();
    };
  }, [provider, undoManager]);

  if (competitionUuid !== undefined && !storeLoaded) {
    return (
      <Box
        display="flex"
        width="100vw"
        height="100vh"
        padding={4}
        alignItems="center"
        justifyContent="center"
      >
        <CircularProgress />
      </Box>
    );
  } else {
    return (
      <context.Provider value={{ provider, store, undoManager, awareness }}>
        {children}
      </context.Provider>
    );
  }
};

function useContextData() {
  const data = useContext(context);

  if (data === undefined) {
    throw new Error('useContext must be used inside StoreProvider');
  }

  return data;
}

export function useCompetition(): Competition {
  const { store } = useContextData();
  const { competition } = useSyncedStore(store);
  return competition as Competition;
}

export function useUndoManager() {
  const { undoManager } = useContextData();
  return undoManager;
}

export function useAwareness() {
  const { awareness } = useContextData();
  return awareness;
}

export default StoreProvider;
