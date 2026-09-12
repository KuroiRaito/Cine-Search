// Turns raw TMDB responses into the shapes the screens actually render.
//
// Every rule here was verified against the live API on 2026-09-12 - see
// docs/TMDB_CAPABILITIES.md. The awkward ones are commented, because they are
// the cases that look like bugs later if you don't know why they're there.

const IMG = 'https://image.tmdb.org/t/p';

export const posterUrl = (path, size = 'w342') => (path ? `${IMG}/${size}${path}` : null);

/**
 * Candidate widths for a poster, so the browser can pick one that suits the
 * device.
 *
 * A 128px tile on a 2x screen occupies 256 real pixels, and on a 3x Android
 * 384 — so the w185 we were asking for was being stretched by up to 2.1x. That
 * is the difference between a poster you can recognise and a smudge. Letting
 * the browser choose also means a 1x screen doesn't pay for pixels it can't
 * show.
 */
export const posterSrcSet = (path) => (path
    ? ['w185', 'w342', 'w500'].map((s) => `${IMG}/${s}${path} ${s.slice(1)}w`).join(', ')
    : null);
// w1280 rather than w780: the hero runs the full width of a desktop window, and
// an upscaled 780px backdrop is visibly soft there.
export const backdropUrl = (path, size = 'w1280') => (path ? `${IMG}/${size}${path}` : null);
export const profileUrl = (path, size = 'w185') => (path ? `${IMG}/${size}${path}` : null);
export const stillUrl = (path, size = 'w185') => (path ? `${IMG}/${size}${path}` : null);

/** 167 -> "2h 47m". Minutes only under an hour. Null stays null. */
export function formatRuntime(minutes) {
    if (!minutes || minutes < 1) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (!h) return `${m}m`;
    return m ? `${h}h ${m}m` : `${h}h`;
}

export const yearOf = (date) => (date ? String(date).slice(0, 4) : null);

/** 18592 -> "18.6k". Keeps a three-column score strip on one line at 375px. */
export function compactCount(n) {
    if (!n) return '0';
    if (n < 1000) return String(n);
    if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
    if (n < 1000000) return `${Math.round(n / 1000)}k`;
    return `${(n / 1000000).toFixed(1)}m`;
}

/**
 * Certification for one region, or null.
 *
 * Verified: TMDB returns an EMPTY STRING for Dune: Part Two in India while
 * returning "A" for Breaking Bad. So empty has to be treated as absent, not as
 * a value - otherwise the meta line renders a blank box (design R13).
 */
export function certificationFor(raw, region, mediaType) {
    if (mediaType === 'tv') {
        const row = raw.content_ratings?.results?.find((r) => r.iso_3166_1 === region);
        return row?.rating?.trim() || null;
    }
    const row = raw.release_dates?.results?.find((r) => r.iso_3166_1 === region);
    const cert = row?.release_dates?.map((d) => d.certification).find((c) => c && c.trim());
    return cert?.trim() || null;
}

/** Streaming / rent / buy for one region, plus the JustWatch link TMDB requires we honour. */
export function providersFor(raw, region) {
    const r = raw['watch/providers']?.results?.[region];
    if (!r) return { region, link: null, flatrate: [], rent: [], buy: [], any: false };
    const map = (list) => (list || []).map((p) => ({
        id: p.provider_id,
        name: p.provider_name,
        logo: p.logo_path ? `${IMG}/w92${p.logo_path}` : null,
    }));
    const flatrate = map(r.flatrate);
    const rent = map(r.rent);
    const buy = map(r.buy);
    return { region, link: r.link || null, flatrate, rent, buy, any: Boolean(flatrate.length || rent.length || buy.length) };
}

/**
 * How many episodes have actually aired.
 *
 * The naive version fetches every season. This needs no extra calls: seasons[]
 * carries episode_count, and last_episode_to_air says where the run has got to.
 * Season 0 (specials) is excluded - verified, Breaking Bad's number_of_episodes
 * of 62 already excludes its 9 specials.
 */
export function airedEpisodeCount(raw) {
    const last = raw.last_episode_to_air;
    if (!last) return 0;
    const earlier = (raw.seasons || [])
        .filter((s) => s.season_number > 0 && s.season_number < last.season_number)
        .reduce((n, s) => n + (s.episode_count || 0), 0);
    return earlier + (last.episode_number || 0);
}

function peopleFromCredits(raw, mediaType) {
    // TV uses aggregate_credits, which spans every season and nests roles[];
    // film uses credits, where the character sits on the row itself.
    if (mediaType === 'tv') {
        const cast = (raw.aggregate_credits?.cast || []).slice(0, 12).map((p) => ({
            id: p.id,
            name: p.name,
            character: p.roles?.[0]?.character || null,
            photo: profileUrl(p.profile_path),
        }));
        const creators = (raw.created_by || []).map((p) => ({
            id: p.id, name: p.name, photo: profileUrl(p.profile_path), job: 'Creator',
        }));
        return { cast, crew: creators };
    }
    const cast = (raw.credits?.cast || []).slice(0, 12).map((p) => ({
        id: p.id, name: p.name, character: p.character || null, photo: profileUrl(p.profile_path),
    }));
    const crewRaw = raw.credits?.crew || [];
    const pick = (job) => crewRaw.filter((c) => c.job === job)
        .map((c) => ({ id: c.id, name: c.name, photo: profileUrl(c.profile_path), job }));
    const crew = [...pick('Director'), ...pick('Screenplay'), ...pick('Writer')];
    // One person can hold two jobs on the same film; show them once.
    const seen = new Set();
    return { cast, crew: crew.filter((c) => !seen.has(c.id) && seen.add(c.id)) };
}

const toCard = (r) => ({
    id: r.id,
    mediaType: r.media_type || (r.first_air_date ? 'tv' : 'movie'),
    title: r.title || r.name || 'Untitled',
    year: yearOf(r.release_date || r.first_air_date),
    poster: posterUrl(r.poster_path, 'w342'),
    posterPath: r.poster_path,
    voteAverage: r.vote_average || null,
});

/**
 * The shared catalogue row for a title, taken from the raw TMDB payload.
 *
 * catalog_titles is world-readable and written once per title for everyone, so
 * a thin row saved by the first person to tap "+" is a thin row for every user
 * after them — the database rejects a second, better write by design. Building
 * this from the full payload rather than from a poster tile is what keeps the
 * genres and keywords in it, which is the whole basis of the taste work later.
 */
/**
 * The crew jobs worth storing, for a film.
 *
 * A title's full crew is not a list anyone reads: Inception alone credits 736
 * people, almost all of them gaffers, assistant editors and drivers. These six
 * are the ones a person actually tracks — the ones they would say made it.
 */
const KEY_JOBS = [
    'Director', 'Writer', 'Screenplay',
    'Original Music Composer', 'Director of Photography',
];

/** Billing order is the only ranking TMDB gives, and it is the right one. */
const CAST_DEPTH = 15;

/**
 * The people behind a title, flattened for storage.
 *
 * Film and television need different rules, because the same job name means
 * different things in each. Breaking Bad lists 25 Directors and 10 Writers in
 * `aggregate_credits` — those are per-episode credits, and storing them would
 * make "your most-watched director" a list of people who did one episode each.
 * A series has one author and TMDB names them in `created_by`.
 *
 * So: a film keeps its key crew; a series keeps its creators, and nothing else
 * from crew. Cast is billing order in both, capped.
 */
export function toCredits(raw, mediaType) {
    const out = [];
    const push = (p, role, job, character, order) => {
        if (!p?.id || !p?.name) return;
        out.push({
            id: p.id,
            name: p.name,
            profile_path: p.profile_path || null,
            department: p.known_for_department || null,
            role,
            job: job || '',
            character: character || null,
            credit_order: order ?? null,
        });
    };

    if (mediaType === 'tv') {
        (raw.aggregate_credits?.cast || [])
            .slice(0, CAST_DEPTH)
            .forEach((p, i) => push(p, 'cast', '', p.roles?.[0]?.character, p.order ?? i));
        (raw.created_by || []).forEach((p) => push(p, 'crew', 'Creator', null, null));
        return out;
    }

    (raw.credits?.cast || [])
        .slice(0, CAST_DEPTH)
        .forEach((p, i) => push(p, 'cast', '', p.character, p.order ?? i));

    // One person can hold two of these jobs on the same film — Nolan writes and
    // directs — and that is two credits, not a duplicate. The table's key is
    // (title, person, role, job), so both are kept and neither collides.
    (raw.credits?.crew || [])
        .filter((c) => KEY_JOBS.includes(c.job))
        .forEach((c) => push(c, 'crew', c.job, null, null));

    return out;
}

export function toCatalog(raw, mediaType) {
    const isTV = mediaType === 'tv';
    return {
        title: raw.title || raw.name || 'Untitled',
        original_title: raw.original_title || raw.original_name || null,
        original_language: raw.original_language || null,
        release_date: raw.release_date || raw.first_air_date || null,
        runtime: (isTV ? raw.episode_run_time?.[0] : raw.runtime) ?? null,
        overview: raw.overview?.trim() || null,
        genres: (raw.genres || []).map((g) => g.name).filter(Boolean),
        keywords: ((raw.keywords?.keywords || raw.keywords?.results) || [])
            .map((k) => k.name).filter(Boolean).slice(0, 25),
        vote_average: raw.vote_average ?? null,
        vote_count: raw.vote_count ?? null,
        popularity: raw.popularity ?? null,
        poster_path: raw.poster_path || null,
        backdrop_path: raw.backdrop_path || null,
        number_of_seasons: isTV ? raw.number_of_seasons ?? null : null,
        // The aired count, not the announced one: a series is "complete" against
        // what exists, and episodes_at_completion has to mean something later.
        number_of_episodes: isTV ? airedEpisodeCount(raw) : null,
        // Season boundaries, so any screen can say which episode comes next
        // without fetching the series again. Specials are excluded: they are
        // not part of the running order.
        seasons: isTV
            ? (raw.seasons || [])
                .filter((s) => s.season_number > 0)
                .map((s) => ({ n: s.season_number, c: s.episode_count || 0 }))
            : [],
        // Carried on the catalogue payload rather than as another argument, so
        // saving a title stays one call and one transaction.
        credits: toCredits(raw, mediaType),
    };
}

export function toTitleView(raw, mediaType, region) {
    const isTV = mediaType === 'tv';
    const { cast, crew } = peopleFromCredits(raw, mediaType);

    // recommendations is behaviour-based and usually better than similar,
    // which goes thin on lesser-known titles. Fall back rather than show nothing.
    const related = (raw.recommendations?.results?.length ? raw.recommendations.results : raw.similar?.results) || [];

    return {
        id: raw.id,
        mediaType,
        title: raw.title || raw.name || 'Untitled',
        originalTitle: raw.original_title || raw.original_name || null,
        originalLanguage: raw.original_language || null,
        tagline: raw.tagline?.trim() || null,
        year: yearOf(raw.release_date || raw.first_air_date),
        runtime: formatRuntime(isTV ? raw.episode_run_time?.[0] : raw.runtime),
        certification: certificationFor(raw, region, mediaType),
        genres: (raw.genres || []).map((g) => g.name),
        overview: raw.overview?.trim() || null,
        poster: posterUrl(raw.poster_path, 'w500'),
        posterPath: raw.poster_path,
        backdrop: backdropUrl(raw.backdrop_path),
        voteAverage: raw.vote_average ? Number(raw.vote_average).toFixed(1) : null,
        voteCount: raw.vote_count || 0,
        cast,
        crew,
        keywords: ((raw.keywords?.keywords || raw.keywords?.results) || []).slice(0, 15).map((k) => ({ id: k.id, name: k.name })),
        providers: providersFor(raw, region),
        related: related.slice(0, 12).map(toCard),
        // series only
        seasons: isTV ? (raw.seasons || []).filter((s) => s.season_number > 0) : [],
        specials: isTV ? (raw.seasons || []).find((s) => s.season_number === 0) || null : null,
        seasonCount: isTV ? raw.number_of_seasons : null,
        episodeCount: isTV ? raw.number_of_episodes : null,
        airedEpisodes: isTV ? airedEpisodeCount(raw) : null,
        status: raw.status || null,
        // Carried along so saving never needs a second fetch of what we have.
        catalog: toCatalog(raw, mediaType),
    };
}

export function toSeasonView(raw) {
    const today = new Date().toISOString().slice(0, 10);
    return {
        seasonNumber: raw.season_number,
        name: raw.name,
        episodes: (raw.episodes || []).map((e) => ({
            id: e.id,
            number: e.episode_number,
            name: e.name,
            airDate: e.air_date || null,
            // Unaired episodes render dimmed and can't be ticked (design edge case).
            aired: Boolean(e.air_date && e.air_date <= today),
            runtime: formatRuntime(e.runtime),
            voteAverage: e.vote_average ? Number(e.vote_average).toFixed(1) : null,
            still: stillUrl(e.still_path),
            overview: e.overview?.trim() || null,
        })),
    };
}

/**
 * A person, with their filmography split by role.
 *
 * Credits with no release date are dropped - verified, 2 of Villeneuve's 26
 * raw director credits are unreleased projects with no date at all.
 */
/**
 * How many votes a credit needs to count as part of someone's body of work.
 *
 * This is a policy, not a fact, and it is the number the design was drawn
 * against: at 200, Villeneuve has exactly the 10 directed features the mock
 * shows. It is a proxy for "is this a real release" and it is an imperfect one
 * — it filters a 1990s Québécois short and a straight-to-video obscurity the
 * same way. The screen says how many it removed, which is what makes an
 * opinionated number honest.
 *
 * Known cost: Emilia Clarke reads 12 rather than the ~20 a viewer would name.
 */
const RELEVANCE_VOTES = 200;

/**
 * TMDB records talk-show appearances and archive footage as cast credits, with
 * the character as "Self". Tom Cruise has 135 cast credits and 57 of them are
 * films; the rest are him being interviewed. Appearing as yourself is not a
 * part you played, so this is a correctness filter rather than a taste one —
 * it runs before the vote threshold and does most of the work.
 */
const isSelf = (c) => /^(self|himself|herself|themselves)\b/i.test(c.character || '');

const dateOf = (c) => c.release_date || c.first_air_date || '';

/** Credits that count toward a body of work, newest first. */
function notableCredits(list) {
    const today = new Date().toISOString().slice(0, 10);
    const seen = new Set();
    return (list || [])
        .filter((c) => {
            const d = dateOf(c);
            // An unreleased film is not something you have failed to watch.
            if (!d || d > today) return false;
            if (isSelf(c)) return false;
            if ((c.vote_count || 0) < RELEVANCE_VOTES) return false;
            // A film credited as both Writer and Screenplay is one film.
            const key = `${c.media_type}-${c.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => String(dateOf(b)).localeCompare(String(dateOf(a))));
}

/**
 * A person, with their filmography split by role.
 *
 * Each role carries its own denominator. "6 of 11" means eleven films they
 * directed, six of which you have seen; switching to Writer changes both halves
 * because it is a different body of work.
 */
export function toPersonView(raw) {
    const credits = raw.combined_credits || {};
    const crewFor = (...jobs) => (credits.crew || []).filter((c) => jobs.includes(c.job));

    const build = (key, label, verb, all) => {
        const items = notableCredits(all).map(toCard);
        return {
            key,
            label,
            // "6 of 10 directed" — the fraction reads as "six of the ten films
            // they directed", so the verb goes last and stays past tense.
            verb,
            items,
            // Everything the filter removed, counted so the screen can admit to
            // it rather than quietly present an opinion as a total.
            filteredOut: all.length - items.length,
        };
    };

    const roles = [
        build('director', 'Director', 'directed', crewFor('Director')),
        build('writer', 'Writer', 'written', crewFor('Writer', 'Screenplay')),
        build('cast', 'Cast', 'acted in', credits.cast || []),
        // A role with nothing left after filtering shows no tab. An empty grid
        // behind a tab that promised a count is worse than no tab.
    ].filter((r) => r.items.length);

    return {
        id: raw.id,
        name: raw.name,
        department: raw.known_for_department || null,
        photo: profileUrl(raw.profile_path, 'h632'),
        biography: raw.biography?.trim() || null,
        birthday: raw.birthday || null,
        deathday: raw.deathday || null,
        placeOfBirth: raw.place_of_birth || null,
        roles,
    };
}

export const fromItem = (it) => ({
    id: it.id,
    mediaType: it.media_type || 'movie',
    title: it.title || 'Untitled',
    year: it.year && it.year !== 'Unknown' ? it.year : null,
    poster: posterUrl(it.poster_path, 'w342'),
    posterPath: it.poster_path,
    voteAverage: it.vote_average || null,
});
