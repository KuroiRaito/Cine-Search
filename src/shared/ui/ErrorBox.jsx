/** Scoped to the section that failed — never the whole page. */
export function ErrorBox({ what, onRetry }) {
    return (
        <div className="errbox">
            <b>Couldn&apos;t load {what}</b>
            <p>The Movie Database didn&apos;t answer. The rest of this page is unaffected.</p>
            {onRetry && <button type="button" className="btn quiet" onClick={onRetry}>Try again</button>}
        </div>
    );
}


