import Button from './Button.jsx';

/** Scoped to the section that failed — never the whole page. */
export function ErrorBox({ what, onRetry }) {
    return (
        <div className="errbox">
            <b>Couldn&apos;t load {what}</b>
            <p>The Movie Database didn&apos;t answer. The rest of this page is unaffected.</p>
            {onRetry && <Button variant="quiet" onClick={onRetry}>Try again</Button>}
        </div>
    );
}


