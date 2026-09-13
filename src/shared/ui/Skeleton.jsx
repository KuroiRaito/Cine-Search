/**
 * The one primitive whose API is dimensional: height and width are its props,
 * so they are the one inline style the design contract allows. Everything else
 * about a skeleton — its radius, its rhythm — is a class.
 */
export function Skeleton({ h = 16, w = '100%', className = '', style }) {
    return <div className={`skel${className ? ` ${className}` : ''}`} style={{ height: h, width: w, ...style }} />;
}

/** Skeletons mirror the layout that's coming, so nothing shifts on arrival. */
export function TitleSkeleton() {
    return (
        <div className="page">
            <Skeleton h={170} className="skel-flat" />
            <div className="title-head">
                <Skeleton h={123} w={82} className="skel-art" />
                <div className="skel-lines tight">
                    <Skeleton h={20} w="75%" />
                    <Skeleton h={12} w="55%" />
                </div>
            </div>
            <div className="card"><Skeleton h={40} /></div>
            <div className="card"><Skeleton h={90} /></div>
        </div>
    );
}
