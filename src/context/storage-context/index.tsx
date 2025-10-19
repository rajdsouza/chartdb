import React from 'react';
import { StorageProvider as DexieStorageProvider } from './storage-provider';
import { StorageProvider as ServerStorageProvider } from './server-storage-provider';

const useServer =
    (import.meta as any).env?.VITE_STORAGE_BACKEND === 'server' ||
    typeof (import.meta as any).env?.VITE_API_BASE === 'string';

export const StorageProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    if (useServer) {
        return <ServerStorageProvider>{children}</ServerStorageProvider>;
    }
    return <DexieStorageProvider>{children}</DexieStorageProvider>;
};
