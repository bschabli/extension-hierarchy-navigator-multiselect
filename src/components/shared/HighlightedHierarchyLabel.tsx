import React from 'react';
import { getSearchMatchRanges } from '../extension/SearchModel';

interface Props {
    label: string;
    searchTerm: string;
}

/** Render matching label fragments with semantic highlight markup. */
export function HighlightedHierarchyLabel(props: Props) {
    const ranges=getSearchMatchRanges(props.label, props.searchTerm);
    if(ranges.length===0) { return <>{props.label}</>; }
    const fragments: React.ReactNode[]=[];
    let cursor=0;
    ranges.forEach((range, index) => {
        if(range.start>cursor) { fragments.push(props.label.slice(cursor, range.start)); }
        fragments.push(
            <mark className='hierarchy-search-match' key={`${ range.start }-${ index }`}>
                {props.label.slice(range.start, range.end)}
            </mark>
        );
        cursor=range.end;
    });
    if(cursor<props.label.length) { fragments.push(props.label.slice(cursor)); }
    return <>{fragments}</>;
}
