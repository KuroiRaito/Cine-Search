/**
 * The one primitive whose API is dimensional: height and width are its props,
 * so they are the one inline style the design contract allows. Everything else
 * about a skeleton — its radius, its rhythm — is a class.
 */
export function Skeleton({ h = 16, w = '100%', className = '', style }) {
    return <div className={`skel${className ? ` ${className}` : ''}`} style={{ height: h, width: w, ...style }} />;
}
