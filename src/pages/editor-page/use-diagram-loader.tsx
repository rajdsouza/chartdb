import { useChartDB } from '@/hooks/use-chartdb';
import { useConfig } from '@/hooks/use-config';
import { useDialog } from '@/hooks/use-dialog';
import { useFullScreenLoader } from '@/hooks/use-full-screen-spinner';
import { useRedoUndoStack } from '@/hooks/use-redo-undo-stack';
import { useStorage } from '@/hooks/use-storage';
import type { Diagram } from '@/lib/domain/diagram';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export const useDiagramLoader = () => {
    const [initialDiagram, setInitialDiagram] = useState<Diagram | undefined>();
    const { diagramId } = useParams<{ diagramId: string }>();
    const { config } = useConfig();
    const { loadDiagram, currentDiagram } = useChartDB();
    const { resetRedoStack, resetUndoStack } = useRedoUndoStack();
    const { showLoader, hideLoader } = useFullScreenLoader();
    const { openCreateDiagramDialog, openOpenDiagramDialog } = useDialog();
    const navigate = useNavigate();
    const { listDiagrams } = useStorage();

    const currentDiagramLoadingRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (!config) {
            return;
        }

        if (currentDiagram?.id === diagramId) {
            return;
        }

        const loadDefaultDiagram = async () => {
            if (diagramId) {
                setInitialDiagram(undefined);
                showLoader();
                resetRedoStack();
                resetUndoStack();
                const diagram = await loadDiagram(diagramId);
                if (!diagram) {
                    openOpenDiagramDialog({ canClose: false });
                    hideLoader();
                    return;
                }

                setInitialDiagram(diagram);
                hideLoader();

                return;
            } else if (!diagramId && config.defaultDiagramId) {
                const diagram = await loadDiagram(config.defaultDiagramId);
                if (diagram) {
                    navigate(`/diagrams/${config.defaultDiagramId}`);

                    return;
                }
            }
            const diagrams = await listDiagrams();

            if (diagrams.length > 0) {
                openOpenDiagramDialog({ canClose: false });
            } else {
                openCreateDiagramDialog();
            }
        };

        if (
            currentDiagramLoadingRef.current === (diagramId ?? '') &&
            currentDiagramLoadingRef.current !== undefined
        ) {
            return;
        }
        currentDiagramLoadingRef.current = diagramId ?? '';

        loadDefaultDiagram();
    }, [
        diagramId,
        openCreateDiagramDialog,
        config,
        navigate,
        listDiagrams,
        loadDiagram,
        resetRedoStack,
        resetUndoStack,
        hideLoader,
        showLoader,
        currentDiagram?.id,
        openOpenDiagramDialog,
    ]);

    // Live updates via SSE when using server-backed storage
    useEffect(() => {
        const USE_SERVER =
            (import.meta as any).env?.VITE_STORAGE_BACKEND === 'server' ||
            typeof (
                typeof window !== 'undefined' && (window as any)?.env?.API_BASE
            ) === 'string';

        if (!USE_SERVER) return;
        if (!diagramId) return;

        const API_BASE: string =
            (import.meta as any).env?.VITE_API_BASE ||
            (typeof window !== 'undefined' && (window as any)?.env?.API_BASE) ||
            '';

        let es: EventSource | undefined;
        try {
            const url = `${API_BASE}/api/diagrams/${diagramId}/events`;
            es = new EventSource(url);

            es.onmessage = async (evt) => {
                try {
                    const data = JSON.parse(evt.data || '{}');
                    if (
                        data?.type === 'diagram_updated' &&
                        data?.id === diagramId
                    ) {
                        // Soft reload current diagram without resetting history
                        await loadDiagram(diagramId);
                    } else if (
                        data?.type === 'diagram_deleted' &&
                        data?.id === diagramId
                    ) {
                        // Navigate user to picker if current diagram was deleted elsewhere
                        openOpenDiagramDialog({ canClose: false });
                    }
                } catch {
                    // ignore malformed events
                }
            };
        } catch {
            // Ignore if EventSource not available or server not reachable
        }

        return () => {
            try {
                es?.close();
            } catch {
                /* empty */
            }
        };
    }, [diagramId, loadDiagram, openOpenDiagramDialog]);

    return { initialDiagram };
};
