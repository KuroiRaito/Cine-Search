import { useEffect, useState } from 'react';
import { Poster } from './ui.jsx';
import { useLibrary } from '../context/LibraryProvider.jsx';
import {
    statusesFor, canRate, statusTone,
    runningOrder, nextUnwatched, lastWatched, epLabel, episodesWatched,
} from '../lib/library.js';

const dateText = (iso) => (iso
    ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null);

/**
 * The editor is a sheet, not a page. You arrive from a title and return to it;
 * it never takes a URL of its own.
 *
 * Save is explicit, because status, rating, progress and who recommended it are
 * four decisions and committing each one as it's touched makes a mess of the
 * activity record. Remove is isolated in the footer and confirms — everything
 * above it is one tap from undoable and that is not.
 */
export default function Editor({ title, onClose }) {
    const { entryFor, save, drop, clearRating } = useLibrary();
    const entry = entryFor(title.mediaType, title.id);
    const isTV = title.mediaType === 'tv';

    const [status, setStatus] = useState(entry?.status ?? (isTV ? 'watching' : 'want_to_watch'));
    const [rating, setRating] = useState(entry?.rating ?? null);
    const [favourite, setFavourite] = useState(entry?.is_favourite ?? false);
    const [watched, setWatched] = useState(entry?.watched_episodes ?? {});
    const [rewatches, setRewatches] = useState(entry?.rewatch_count ?? 0);
    const [by, setBy] = useState(entry?.recommended_by ?? '');
    const [notes, setNotes] = useState(entry?.notes ?? '');
    const [rateNote, setRateNote] = useState(false);
    // Whether the person actually took their score off, as opposed to the score
    // merely not being editable under the status they just chose.
    const [cleared, setCleared] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const order = isTV ? runningOrder(title.seasons, title.airedEpisodes) : [];
    const seen = episodesWatched(watched);
    const total = order.length;
    const next = nextUnwatched(order, watched);
    const last = lastWatched(order, watched);

    const step = (dir) => {
        const target = dir > 0 ? next : last;
        if (!target) return;
        const key = String(target.season);
        const list = new Set(watched[key] || []);
        if (dir > 0) list.add(target.episode); else list.delete(target.episode);
        const nextMap = { ...watched };
        if (list.size) nextMap[key] = [...list].sort((a, b) => a - b);
        else delete nextMap[key];
        setWatched(nextMap);
        // Logging an episode is a statement that you're watching it. Nobody
        // should have to set a status before they can record progress.
        if (dir > 0 && status === 'want_to_watch') setStatus('watching');
    };

    // Five stars over a ten-point scale: a whole star is two points, a half is
    // one. Matching TMDB's scale is the point — "your 8 against their 8.9" only
    // means something if both numbers are on the same ruler.
    const pickRating = (value) => {
        if (!canRate(status)) { setRateNote(true); return; }
        setRateNote(false);
        setRating(value === rating ? null : value);
        setCleared(value === rating);
    };

    const onSave = async () => {
        setBusy(true);
        const ok = await save(title, {
            status,
            rating: canRate(status) ? rating : null,
            favourite,
            rewatches,
            recommendedBy: by.trim() || null,
            // Empty string rather than null: emptying the box is an
            // instruction to delete the note, not an absence of one.
            notes: notes.trim(),
            episodes: isTV ? watched : null,
        });
        // Clearing is a different intention from not passing one, so it is a
        // different call — and it is only ever the person's intention. Moving a
        // title from Watched back to Watching makes the score uneditable; it
        // does not make the score untrue, and erasing it there is data loss the
        // person never asked for.
        if (ok && cleared && entry?.rating != null) await clearRating(title);
        setBusy(false);
        if (ok) onClose();
    };

    const onRemove = async () => {
        setBusy(true);
        const ok = await drop(title);
        setBusy(false);
        if (ok) onClose();
    };

    const meta = [
        title.year,
        isTV && title.seasonCount && `${title.seasonCount} season${title.seasonCount === 1 ? '' : 's'}`,
        isTV && total && `${total} episodes`,
        !isTV && title.runtime,
    ].filter(Boolean).join(' · ');

    return (
        <div className="scrim" role="dialog" aria-modal="true" aria-label={`Edit ${title.title}`} onClick={onClose}>
            <div className={`sheet editor ${statusTone(status)}`} onClick={(e) => e.stopPropagation()}>
                <div className="sh-grab" />

                <div className="sh-head">
                    <div className="sh-po"><Poster src={title.poster} title={title.title} /></div>
                    <div className="sh-t">
                        <b>{title.title}</b>
                        <span>{meta}</span>
                    </div>
                    <button
                        type="button"
                        className={`ibtn like${favourite ? ' on' : ''}`}
                        aria-pressed={favourite}
                        aria-label={favourite ? 'Remove from favourites' : 'Mark as favourite'}
                        onClick={() => setFavourite((f) => !f)}
                    >♥</button>
                    <button type="button" className="btn" disabled={busy} onClick={onSave}>
                        {busy ? 'Saving…' : 'Save'}
                    </button>
                </div>

                <div className="fld">
                    <label htmlFor="ed-status">Status</label>
                    <div className="segs" id="ed-status" role="group">
                        {statusesFor(title.mediaType).map((s) => (
                            <button
                                key={s.key}
                                type="button"
                                className={`seg ${s.tone}${status === s.key ? ' on' : ''}`}
                                aria-pressed={status === s.key}
                                onClick={() => setStatus(s.key)}
                            >
                                {s.icon}<i>{s.short}</i>
                            </button>
                        ))}
                    </div>
                </div>

                {/* The editor counts episodes; the title page names them. Editing
                    is arithmetic, reading is orientation. */}
                {isTV && total > 0 && (
                    <div className="fld">
                        <label htmlFor="ed-prog">Progress</label>
                        <div className="prog" id="ed-prog">
                            <button type="button" className="stp" onClick={() => step(-1)} disabled={!last} aria-label="One fewer episode">−</button>
                            <div className="prog-v"><b>{seen}</b><span>of {total} episodes</span></div>
                            <button type="button" className="stp" onClick={() => step(1)} disabled={!next} aria-label="One more episode">+</button>
                        </div>
                        <div className="jump">
                            {next
                                ? <>Up next <b>{epLabel(next)}</b></>
                                : <>Every aired episode watched</>}
                        </div>
                    </div>
                )}

                <div className="fld">
                    <label htmlFor="ed-rating">Your rating</label>
                    <div className="stars" id="ed-rating">
                        {[1, 2, 3, 4, 5].map((n) => {
                            const full = rating != null && rating >= n * 2;
                            const half = rating != null && !full && rating >= n * 2 - 1;
                            return (
                                <button
                                    key={n}
                                    type="button"
                                    className={`${full ? 'on' : ''}${half ? ' half' : ''}`}
                                    aria-label={`${n * 2} out of 10`}
                                    onClick={() => pickRating(n * 2)}
                                    onContextMenu={(e) => { e.preventDefault(); pickRating(n * 2 - 1); }}
                                >★</button>
                            );
                        })}
                        <span className="sv">{rating != null ? `${rating} / 10` : '—'}</span>
                        {rating != null && (
                            <button
                                type="button"
                                className="clear"
                                onClick={() => { setRating(null); setCleared(true); }}
                            >Clear</button>
                        )}
                    </div>
                    {rateNote && (
                        <p className="hint">
                            Mark it watched first — a score is a record of having seen it.
                        </p>
                    )}
                </div>

                <div className="fld2">
                    <div>
                        <label htmlFor="ed-started">Started</label>
                        <div className={`inp${entry?.started_at ? '' : ' dim'}`} id="ed-started">
                            {dateText(entry?.started_at) || '—'}
                        </div>
                    </div>
                    <div>
                        <label htmlFor="ed-finished">Finished</label>
                        <div className={`inp${entry?.completed_at ? '' : ' dim'}`} id="ed-finished">
                            {dateText(entry?.completed_at) || '—'}
                        </div>
                    </div>
                </div>

                <div className="fld">
                    <label htmlFor="ed-rewatch">Rewatches</label>
                    <div className="prog compact" id="ed-rewatch">
                        <button type="button" className="stp" disabled={rewatches < 1} onClick={() => setRewatches((n) => Math.max(0, n - 1))} aria-label="One fewer rewatch">−</button>
                        <div className="prog-v"><b>{rewatches}</b></div>
                        <button type="button" className="stp" onClick={() => setRewatches((n) => n + 1)} aria-label="One more rewatch">+</button>
                    </div>
                </div>

                {/* Free text with an auto-stamped month. Asking someone to pick a
                    date to record "Ravi told me about it" costs more than the
                    fact is worth. */}
                <div className="fld">
                    <label htmlFor="ed-by">Who recommended it?</label>
                    <input
                        id="ed-by"
                        className="inp"
                        type="text"
                        value={by}
                        maxLength={80}
                        placeholder="A name, or where you heard of it"
                        onChange={(e) => setBy(e.target.value)}
                    />
                    <p className="hint">Optional. Only you ever see this.</p>
                </div>

                {/* Private, and staying that way: publishing was parked with
                    Layer 3, so a note is never a review in waiting. */}
                <div className="fld">
                    <label htmlFor="ed-notes">Notes</label>
                    <textarea
                        id="ed-notes"
                        className="inp notes"
                        value={notes}
                        maxLength={2000}
                        rows={3}
                        placeholder="Private to you…"
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>

                <div className="sh-foot">
                    {confirming ? (
                        <>
                            <p className="del-confirm">
                                This erases {[
                                    'its status',
                                    rating != null && 'your rating',
                                    favourite && 'the favourite',
                                    notes.trim() && 'your notes',
                                    isTV && seen > 0 && `all ${seen} watched episode${seen === 1 ? '' : 's'}`,
                                ].filter(Boolean).join(', ').replace(/,([^,]*)$/, ' and$1')} — not just from this screen.
                            </p>
                            <div className="del-row">
                                <button type="button" className="btn quiet" onClick={() => setConfirming(false)}>Keep it</button>
                                <button type="button" className="del" disabled={busy} onClick={onRemove}>Remove</button>
                            </div>
                        </>
                    ) : (
                        <button type="button" className="del" disabled={!entry} onClick={() => setConfirming(true)}>
                            Remove from library
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
