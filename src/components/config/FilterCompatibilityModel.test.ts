import { compareFilterValueSamples } from './FilterCompatibilityModel';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

const partial=compareFilterValueSamples(
    ['A', 'B', 'B', 'C'],
    ['A', 'C', 'D']
);
assert(partial.sourceCount===3, 'Repeated source values should be compared once.');
assert(partial.targetCount===3, 'Distinct target sample values should be counted.');
assert(partial.matchCount===2, 'Matching source values should be counted exactly.');
assert(partial.matchPercent===67, 'Compatibility percentages should be rounded to whole numbers.');
assert(partial.missingExamples.join(',')==='B', 'Missing examples should identify unmapped source values.');

const empty=compareFilterValueSamples([], []);
assert(empty.matchPercent===100, 'An empty source set should not be reported as incompatible.');

console.log('Filter compatibility model tests passed.');
