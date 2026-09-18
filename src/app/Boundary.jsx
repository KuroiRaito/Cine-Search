import { Component } from 'react';
import { Link } from 'react-router-dom';

/**
 * A failure is contained by the smallest thing that can contain it.
 *
 * `componentDidCatch` and `getDerivedStateFromError` appeared zero times in
 * this codebase, which means React's default applied: an uncaught render error
 * tears the whole tree down. A white page, no tabs, no wordmark, no route — the
 * app has not crashed visibly, it has simply stopped existing, and a refresh
 * returns to the same route and the same crash.
 *
 * Three levels, and the product already had the third:
 *
 *   1 · section   a failed request inside one band     ErrorBox, shipped
 *   2 · route     a module that throws while rendering this, SH2
 *   3 · app       a throw in the shell itself           this, SH3
 *
 * The only class component in the product, because catching a render error is
 * the one thing hooks still cannot do.
 */
export default class Boundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null, id: null };
    }

    static getDerivedStateFromError(error) {
        /* Short, mono, and quotable. There is no error service and adding one
           is a real decision with a real bill — but an id somebody can put in a
           message is worth four lines even with nothing behind it, and when a
           service does arrive this is already the thing it keys on. */
        const id = Math.random().toString(36).slice(2, 8).toUpperCase();
        return { error, id };
    }

    componentDidCatch(error, info) {
        // Logged locally, because that is where it can be read today.
        console.error(`[${this.state?.id ?? '—'}]`, error, info?.componentStack);
    }

    componentDidUpdate(prev) {
        /* SH4 — the boundary resets when the route changes.
           An error boundary that keeps its error after navigation turns one
           broken screen into a permanently broken tab: you tap Library, get the
           failure, tap Discover, and get the same failure. Keying it to the
           pathname is the whole fix, and forgetting it is the classic way this
           ships broken. */
        if (this.state.error && prev.resetKey !== this.props.resetKey) {
            this.setState({ error: null, id: null });
        }
    }

    render() {
        if (!this.state.error) return this.props.children;
        if (this.props.level === 'app') return <AppDead id={this.state.id} />;
        return (
            <div className="page broke">
                {/* Not "Something went wrong", which is true of everything and
                    useful for nothing. It says which thing. */}
                <h1>This screen stopped working.</h1>
                {/* The first fear on a tracker is the library. Answer it
                    before it is asked. */}
                <p>Nothing you saved is affected.</p>
                <div className="broke-do">
                    <button
                        type="button"
                        className="btn"
                        onClick={() => this.setState({ error: null, id: null })}
                    >Try again</button>
                    <Link className="btn quiet" to="/">Go to Discover</Link>
                </div>
                {/* Never the stack. A stack trace on screen tells a person
                    nothing, and tells them loudly. */}
                <p className="broke-id">{this.state.id}</p>
            </div>
        );
    }
}

/**
 * SH3 — the shell itself threw, so nothing else can be trusted: not the
 * router, not the tabs, not a Link. A plain reload is the only honest offer.
 */
function AppDead({ id }) {
    return (
        <div className="page broke">
            <h1>Cine Search stopped working.</h1>
            <p>Nothing you saved is affected.</p>
            <div className="broke-do">
                <button type="button" className="btn" onClick={() => window.location.assign('/')}>Reload</button>
            </div>
            <p className="broke-id">{id}</p>
        </div>
    );
}
