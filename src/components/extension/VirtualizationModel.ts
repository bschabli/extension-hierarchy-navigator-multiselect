export interface VirtualWindow {
    endIndex: number;
    paddingBottom: number;
    paddingTop: number;
    startIndex: number;
}

/** Calculate the overscanned slice needed for a fixed-height virtual tree viewport. */
export function getVirtualWindow(
    itemCount: number,
    scrollTop: number,
    viewportHeight: number,
    rowHeight: number,
    overscan: number
): VirtualWindow {
    if(itemCount<=0||rowHeight<=0) {
        return { endIndex: 0, paddingBottom: 0, paddingTop: 0, startIndex: 0 };
    }
    const safeScrollTop=Math.max(0, scrollTop);
    const safeViewportHeight=Math.max(rowHeight, viewportHeight);
    const startIndex=Math.min(
        itemCount-1,
        Math.max(0, Math.floor(safeScrollTop/rowHeight)-Math.max(0, overscan))
    );
    const visibleEnd=Math.ceil((safeScrollTop+safeViewportHeight)/rowHeight);
    const endIndex=Math.min(itemCount, visibleEnd+Math.max(0, overscan));
    return {
        endIndex,
        paddingBottom: Math.max(0, (itemCount-endIndex)*rowHeight),
        paddingTop: startIndex*rowHeight,
        startIndex
    };
}
