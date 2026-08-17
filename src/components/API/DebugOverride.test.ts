import { isDebugEnabled } from './DebugOverride';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

assert(!isDebugEnabled(false, false), 'Debug output should remain disabled when both inputs are false.');
assert(isDebugEnabled(true, false), 'The saved debug setting should enable debug output.');
assert(isDebugEnabled(false, true), 'The source-level override should enable debug output.');

console.log('Debug override tests passed.');
