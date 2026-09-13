import { Skeleton } from '../../shared/ui/index.js';

/**
 * Skeletons mirror the layout that's coming, so nothing shifts on arrival.
 *
 * It lives here rather than in shared/ui because it draws THIS screen: it is
 * the title page in outline, and it has to move whenever the title page moves.
 */
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
