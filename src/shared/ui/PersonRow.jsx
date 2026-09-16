import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

export const initialsOf = (name = '') =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/**
 * A person as a row rather than a chip — name, role, and somewhere to go. Used
 * wherever there's horizontal room, which is most places once the cast list
 * isn't fighting a rail for space.
 */
export function PersonRow({ person, sub }) {
    return (
        <Link to={`/person/${person.id}`} className="prow">
            <span className={`pf${person.photo ? '' : ' noimg'}`}>
                {person.photo ? <img src={person.photo} alt="" loading="lazy" /> : initialsOf(person.name)}
            </span>
            <span className="pb">
                <b>{person.name}</b>
                {sub && <span>{sub}</span>}
            </span>
            <span className="go"><Icon name="forward" size={16} /></span>
        </Link>
    );
}

