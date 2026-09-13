import { Link } from 'react-router-dom';

/**
 * The canonical home for attribution.
 *
 * Credit is contractual, but it doesn't have to be loud. Everywhere else in the
 * product carries at most one quiet line; the full notice lives here, out of
 * the way of the thing people came to do. That includes crediting JustWatch for
 * the streaming availability, which is theirs even though the links resolve to
 * TMDB pages.
 */
export default function About() {
    return (
        <div className="page">
            <div className="page-head"><h1>About</h1></div>

            <div className="card">
                <h2 className="about-h">Cine Search</h2>
                <p className="about-p">
                    Films and series in one place. Track what you&apos;re watching, remember what
                    you loved, and find the next thing.
                </p>
            </div>

            <div className="card">
                <h2 className="about-h">Where the data comes from</h2>
                <p className="about-p">
                    Film and television data is from{' '}
                    <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer noopener">The Movie Database</a>.
                    This product uses the TMDB API but is not endorsed or certified by TMDB.
                </p>
                <p className="about-p">
                    Streaming availability is provided by{' '}
                    <a href="https://www.justwatch.com" target="_blank" rel="noreferrer noopener">JustWatch</a>,
                    surfaced through TMDB.
                </p>
            </div>

            <div className="card">
                <h2 className="about-h">Your data</h2>
                <p className="about-p">
                    Your library is private by default. Nobody else can see what you save, rate
                    or watch.
                </p>
            </div>

            <div className="pad stack">
                <Link className="btn quiet" to="/">Back to Discover</Link>
            </div>
        </div>
    );
}
