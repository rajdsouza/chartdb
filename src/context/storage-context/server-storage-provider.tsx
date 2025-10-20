import React, { useCallback } from 'react';
import type { StorageContext } from './storage-context';
import { storageContext } from './storage-context';
import type { Diagram } from '@/lib/domain/diagram';
import type { DBTable } from '@/lib/domain/db-table';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import type { ChartDBConfig } from '@/lib/domain/config';
import type { DBDependency } from '@/lib/domain/db-dependency';
import type { Area } from '@/lib/domain/area';
import type { DBCustomType } from '@/lib/domain/db-custom-type';
import type { DiagramFilter } from '@/lib/domain/diagram-filter/diagram-filter';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { attributes } from 'happy-dom/lib/PropertySymbol.d.ts.js';

const API_BASE: string =
    (import.meta as any).env?.VITE_API_BASE ||
    (typeof window !== 'undefined' && (window as any)?.env?.API_BASE) ||
    '';

async function http<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${url}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        ...options,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text}`);
    }
    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
}

async function getDiagramServer(
    id: string | undefined
): Promise<Diagram | undefined> {
    if (!id) return undefined;
    try {
        return await http<Diagram>(`/api/diagrams/${id}`);
    } catch (e) {
        return undefined;
    }
}

async function saveDiagramServer(diagram: Diagram): Promise<void> {
    await http<Diagram>(`/api/diagrams/${diagram.id}`, {
        method: 'PUT',
        body: JSON.stringify(diagram),
    });
}

function toDate(v: unknown): Date {
    return v instanceof Date ? (v as Date) : new Date(v as any);
}
function normalizeDiagram(d: Diagram): Diagram {
    return {
        ...d,
        createdAt: toDate(d.createdAt as unknown as any),
        updatedAt: toDate(d.updatedAt as unknown as any),
    };
}

export const StorageProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    // Config: keep a stub server-side for now, store defaultDiagramId in a synthetic way
    const getConfig: StorageContext['getConfig'] = useCallback(async () => {
        const diagrams = await http<Diagram[]>(`/api/diagrams`);
        const defaultDiagramId = diagrams?.[0]?.id || '';
        return { id: 1, defaultDiagramId } as unknown as ChartDBConfig;
    }, []);

    const updateConfig: StorageContext['updateConfig'] = useCallback(
        async (_config) => {
            // No-op on server for now; clients can remember last opened separately if needed.
        },
        []
    );

    const getDiagramFilter: StorageContext['getDiagramFilter'] = useCallback(
        async (diagramId: string) => {
            const diagram = await getDiagramServer(diagramId);
            return (diagram as any)?.diagramFilter as DiagramFilter | undefined;
        },
        []
    );

    const updateDiagramFilter: StorageContext['updateDiagramFilter'] =
        useCallback(async (diagramId, filter) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            (diagram as any).diagramFilter = filter;
            await saveDiagramServer(diagram);
        }, []);

    const deleteDiagramFilter: StorageContext['deleteDiagramFilter'] =
        useCallback(async (diagramId: string) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            if (diagram) {
                delete (diagram as any).diagramFilter;
                await saveDiagramServer(diagram);
            }
        }, []);

    // Diagram operations
    const addDiagram: StorageContext['addDiagram'] = useCallback(
        async ({ diagram }) => {
            await http<Diagram>(`/api/diagrams`, {
                method: 'POST',
                body: JSON.stringify(diagram),
            });
        },
        []
    );

    const listDiagrams: StorageContext['listDiagrams'] =
        useCallback(async () => {
            const diagrams = await http<Diagram[]>(`/api/diagrams`);
            return diagrams.map(normalizeDiagram);
        }, []);

    const getDiagram: StorageContext['getDiagram'] = useCallback(
        async (id: string) => {
            const d = await getDiagramServer(id);
            if (!d) return d;
            return normalizeDiagram(d);
        },
        []
    );

    const updateDiagram: StorageContext['updateDiagram'] = useCallback(
        async ({ id, attributes }) => {
            await http<Diagram>(`/api/diagrams/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(attributes),
            });
        },
        []
    );

    const deleteDiagram: StorageContext['deleteDiagram'] = useCallback(
        async (id: string) => {
            await http<void>(`/api/diagrams/${id}`, { method: 'DELETE' });
        },
        []
    );

    // Helpers to patch list properties
    const upsertItem = <T extends { id: string }>(
        arr: T[] = [],
        item: T
    ): T[] => {
        const idx = arr.findIndex((t) => t.id === item.id);
        if (idx >= 0) {
            const copy = arr.slice();
            copy[idx] = { ...copy[idx], ...item };
            return copy;
        }
        return [...arr, item];
    };

    const removeItem = <T extends { id: string }>(
        arr: T[] = [],
        id: string
    ): T[] => {
        return arr.filter((t) => t.id !== id);
    };

    // Tables
    const addTable: StorageContext['addTable'] = useCallback(
        async ({ diagramId, table }) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            diagram.tables = upsertItem(diagram.tables, table);
            await saveDiagramServer(diagram);
        },
        []
    );

    const getTable: StorageContext['getTable'] = useCallback(
        async ({ diagramId, id }) => {
            const diagram = await getDiagramServer(diagramId);
            return diagram?.tables?.find((t) => t.id === id);
        },
        []
    );

    const updateTable: StorageContext['updateTable'] = useCallback(
        async ({ diagramId, id, attributes }) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            const existing = diagram.tables?.find(
                (t) => t.id === id
            ) as DBTable;
            diagram.tables = upsertItem(diagram.tables, {
                ...existing,
                ...attributes,
                id,
            } as DBTable);
            await saveDiagramServer(diagram);
        },
        []
    );

    const putTable: StorageContext['putTable'] = useCallback(
        async ({ diagramId, table }) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            diagram.tables = upsertItem(diagram.tables, table);
            await saveDiagramServer(diagram);
        },
        []
    );

    const deleteTable: StorageContext['deleteTable'] = useCallback(
        async ({ diagramId, id }) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            diagram.tables = removeItem(diagram.tables, id);
            await saveDiagramServer(diagram);
        },
        []
    );

    const listTables: StorageContext['listTables'] = useCallback(
        async (diagramId: string) => {
            const diagram = await getDiagramServer(diagramId);
            return diagram?.tables || [];
        },
        []
    );

    const deleteDiagramTables: StorageContext['deleteDiagramTables'] =
        useCallback(async (diagramId: string) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            diagram.tables = [];
            await saveDiagramServer(diagram);
        }, []);

    // Relationships
    const addRelationship: StorageContext['addRelationship'] = useCallback(
        async ({ diagramId, relationship }) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            diagram.relationships = upsertItem(
                diagram.relationships,
                relationship
            );
            await saveDiagramServer(diagram);
        },
        []
    );

    const getRelationship: StorageContext['getRelationship'] = useCallback(
        async ({ diagramId, id }) => {
            const diagram = await getDiagramServer(diagramId);
            return diagram?.relationships?.find((t) => t.id === id);
        },
        []
    );

    const updateRelationship: StorageContext['updateRelationship'] =
        useCallback(async ({ id, attributes }) => {
            const diagramId = (attributes as any).diagramId as string;
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            const existing = diagram.relationships?.find(
                (t) => t.id === id
            ) as DBRelationship;
            diagram.relationships = upsertItem(diagram.relationships, {
                ...existing,
                ...attributes,
                id,
            } as DBRelationship);
            await saveDiagramServer(diagram);
        }, []);

    const deleteRelationship: StorageContext['deleteRelationship'] =
        useCallback(async ({ diagramId, id }) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            diagram.relationships = removeItem(diagram.relationships, id);
            await saveDiagramServer(diagram);
        }, []);

    const listRelationships: StorageContext['listRelationships'] = useCallback(
        async (diagramId: string) => {
            const diagram = await getDiagramServer(diagramId);
            return diagram?.relationships || [];
        },
        []
    );

    const deleteDiagramRelationships: StorageContext['deleteDiagramRelationships'] =
        useCallback(async (diagramId: string) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            diagram.relationships = [];
            await saveDiagramServer(diagram);
        }, []);

    // Dependencies
    const addDependency: StorageContext['addDependency'] = useCallback(
        async ({ diagramId, dependency }) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            diagram.dependencies = upsertItem(diagram.dependencies, dependency);
            await saveDiagramServer(diagram);
        },
        []
    );

    const getDependency: StorageContext['getDependency'] = useCallback(
        async ({ diagramId, id }) => {
            const diagram = await getDiagramServer(diagramId);
            return diagram?.dependencies?.find((t) => t.id === id);
        },
        []
    );

    const updateDependency: StorageContext['updateDependency'] = useCallback(
        async ({ id, attributes }) => {
            const diagramId = (attributes as any).diagramId as string;
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            const existing = diagram.dependencies?.find(
                (t) => t.id === id
            ) as DBDependency;
            diagram.dependencies = upsertItem(diagram.dependencies, {
                ...existing,
                ...attributes,
                id,
            } as DBDependency);
            await saveDiagramServer(diagram);
        },
        []
    );

    const deleteDependency: StorageContext['deleteDependency'] = useCallback(
        async ({ diagramId, id }) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            diagram.dependencies = removeItem(diagram.dependencies, id);
            await saveDiagramServer(diagram);
        },
        []
    );

    const listDependencies: StorageContext['listDependencies'] = useCallback(
        async (diagramId: string) => {
            const diagram = await getDiagramServer(diagramId);
            return diagram?.dependencies || [];
        },
        []
    );

    const deleteDiagramDependencies: StorageContext['deleteDiagramDependencies'] =
        useCallback(async (diagramId: string) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            diagram.dependencies = [];
            await saveDiagramServer(diagram);
        }, []);

    // Areas
    const addArea: StorageContext['addArea'] = useCallback(
        async ({ diagramId, area }) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            diagram.areas = upsertItem(diagram.areas, area);
            await saveDiagramServer(diagram);
        },
        []
    );

    const getArea: StorageContext['getArea'] = useCallback(
        async ({ diagramId, id }) => {
            const diagram = await getDiagramServer(diagramId);
            return diagram?.areas?.find((t) => t.id === id);
        },
        []
    );

    const updateArea: StorageContext['updateArea'] = useCallback(
        async ({ id, attributes }) => {
            const diagramId = (attributes as any).diagramId as string;
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            const existing = diagram.areas?.find((t) => t.id === id) as Area;
            diagram.areas = upsertItem(diagram.areas, {
                ...existing,
                ...attributes,
                id,
            } as Area);
            await saveDiagramServer(diagram);
        },
        []
    );

    const deleteArea: StorageContext['deleteArea'] = useCallback(
        async ({ diagramId, id }) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            diagram.areas = removeItem(diagram.areas, id);
            await saveDiagramServer(diagram);
        },
        []
    );

    const listAreas: StorageContext['listAreas'] = useCallback(
        async (diagramId: string) => {
            const diagram = await getDiagramServer(diagramId);
            return diagram?.areas || [];
        },
        []
    );

    const deleteDiagramAreas: StorageContext['deleteDiagramAreas'] =
        useCallback(async (diagramId: string) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            diagram.areas = [];
            await saveDiagramServer(diagram);
        }, []);

    // Custom Types
    const addCustomType: StorageContext['addCustomType'] = useCallback(
        async ({ diagramId, customType }) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            diagram.customTypes = upsertItem(diagram.customTypes, customType);
            await saveDiagramServer(diagram);
        },
        []
    );

    const getCustomType: StorageContext['getCustomType'] = useCallback(
        async ({ diagramId, id }) => {
            const diagram = await getDiagramServer(diagramId);
            return diagram?.customTypes?.find((t) => t.id === id);
        },
        []
    );

    const updateCustomType: StorageContext['updateCustomType'] = useCallback(
        async ({ id, attributes }) => {
            const diagramId = (attributes as any).diagramId as string;
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            const existing = diagram.customTypes?.find(
                (t) => t.id === id
            ) as DBCustomType;
            diagram.customTypes = upsertItem(diagram.customTypes, {
                ...existing,
                ...attributes,
                id,
            } as DBCustomType);
            await saveDiagramServer(diagram);
        },
        []
    );

    const deleteCustomType: StorageContext['deleteCustomType'] = useCallback(
        async ({ diagramId, id }) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            diagram.customTypes = removeItem(diagram.customTypes, id);
            await saveDiagramServer(diagram);
        },
        []
    );

    const listCustomTypes: StorageContext['listCustomTypes'] = useCallback(
        async (diagramId: string) => {
            const diagram = await getDiagramServer(diagramId);
            return diagram?.customTypes || [];
        },
        []
    );

    const deleteDiagramCustomTypes: StorageContext['deleteDiagramCustomTypes'] =
        useCallback(async (diagramId: string) => {
            const diagram = (await getDiagramServer(diagramId)) as Diagram;
            diagram.customTypes = [];
            await saveDiagramServer(diagram);
        }, []);

    return (
        <storageContext.Provider
            value={{
                getConfig,
                updateConfig,
                addDiagram,
                listDiagrams,
                getDiagram,
                updateDiagram,
                deleteDiagram,
                addTable,
                getTable,
                updateTable,
                putTable,
                deleteTable,
                listTables,
                addRelationship,
                getRelationship,
                updateRelationship,
                deleteRelationship,
                listRelationships,
                deleteDiagramTables,
                deleteDiagramRelationships,
                addDependency,
                getDependency,
                updateDependency,
                deleteDependency,
                listDependencies,
                deleteDiagramDependencies,
                addArea,
                getArea,
                updateArea,
                deleteArea,
                listAreas,
                deleteDiagramAreas,
                addCustomType,
                getCustomType,
                updateCustomType,
                deleteCustomType,
                listCustomTypes,
                deleteDiagramCustomTypes,
                getDiagramFilter,
                updateDiagramFilter,
                deleteDiagramFilter,
            }}
        >
            {children}
        </storageContext.Provider>
    );
};
