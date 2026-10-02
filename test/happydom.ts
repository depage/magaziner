import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { ISyncResponse, BrowserWindow } from "happy-dom";

const fetchHandlers = new Map<string, () => Response>();

GlobalRegistrator.register({
    url: 'http://localhost/',
    settings: {
        fetch: {
            interceptor: {
                beforeAsyncRequest: async ({ request, window }: { request: Request; window: BrowserWindow }) => {
                    const handler = fetchHandlers.get(request.url);
                    if (handler) return handler() as unknown as Response;
                    throw new Error(`No fetch handler registered for: ${request.url}`);
                },
                beforeSyncRequest: ({ request }: { request: Request }) => {
                    const handler = fetchHandlers.get(request.url);
                    if (handler) return handler() as unknown as ISyncResponse;
                },
            }
        }
    }
} as unknown as { settings: Record<string, unknown> });

export function setupFetchMock() {
    return {
        for(url: string) {
            return {
                html(content: string) {
                    fetchHandlers.set(url, () => new Response(content));
                }
            };
        }
    };
}

export function resetFetchMock() {
    fetchHandlers.clear();
}
