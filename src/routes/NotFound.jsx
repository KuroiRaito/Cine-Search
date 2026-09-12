import { Link } from 'react-router-dom';
import { Empty } from '../components/ui.jsx';

export default function NotFound() {
    return (
        <Empty
            title="This page doesn't exist"
            body="The link may be wrong, or the page may have moved."
            action={<Link className="btn" to="/">Go to Discover</Link>}
        />
    );
}
