import { useState, useEffect, useCallback } from 'react';

/**
 * Runs an async loader and tracks its state, cancelling in flight work when the
 * inputs change or the component unmounts.
 *
 * Each section of a page gets its own call, which is what makes the design's
 * "errors are scoped to the section that failed" rule fall out for free: a dead
 * provider call cannot blank a title page that already has its synopsis.
 */
export function useAsync(loader, deps, { skip = false } = {}) {
    const [state, setState] = useState({ data: null, error: null, loading: !skip });
    const [nonce, setNonce] = useState(0);

    const retry = useCallback(() => setNonce((n) => n + 1), []);

    useEffect(() => {
        if (skip) {
            setState({ data: null, error: null, loading: false });
            return undefined;
        }
        const controller = new AbortController();
        let live = true;
        setState((s) => ({ ...s, loading: true, error: null }));

        loader({ signal: controller.signal })
            .then((data) => { if (live) setState({ data, error: null, loading: false }); })
            .catch((err) => {
                if (!live || err?.name === 'AbortError' || controller.signal.aborted) return;
                setState({ data: null, error: err, loading: false });
            });

        return () => { live = false; controller.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, nonce, skip]);

    return { ...state, retry };
}
