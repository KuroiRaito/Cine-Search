import { Link } from 'react-router-dom';
import { Empty, Button} from '../shared/ui/index.js';

export default function NotFound() {
    return (
        <Empty
            title="This page doesn't exist"
            body="The link may be wrong, or the page may have moved."
            action={<Button as={Link} to="/">Go to Discover</Button>}
        />
    );
}
