export function Empty({ title, body, action }) {
    return (
        <div className="empty">
            <h2>{title}</h2>
            {body && <p>{body}</p>}
            {action}
        </div>
    );
}

