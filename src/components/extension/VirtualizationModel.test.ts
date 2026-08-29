import { getVirtualWindow } from './VirtualizationModel';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

const initial=getVirtualWindow(10000, 0, 320, 32, 5);
assert(initial.startIndex===0&&initial.endIndex===15, 'The initial window should include visible rows and overscan.');
assert(initial.paddingTop===0, 'The first virtual window should not add top padding.');
assert(initial.paddingBottom===9985*32, 'Unrendered rows should retain their scroll height.');

const middle=getVirtualWindow(10000, 3200, 320, 32, 5);
assert(middle.startIndex===95, 'Virtualization should overscan before the visible window.');
assert(middle.endIndex===115, 'Virtualization should overscan after the visible window.');

const clamped=getVirtualWindow(10, 100000, 320, 32, 5);
assert(clamped.startIndex===9&&clamped.endIndex===10, 'Stale scroll positions should clamp to the available rows.');

console.log('Virtualization model tests passed.');
