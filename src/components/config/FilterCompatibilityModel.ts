export interface FilterCompatibilityResult {
    matchCount: number;
    matchPercent: number;
    missingExamples: string[];
    sourceCount: number;
    targetCount: number;
}

/** Compare mapped source values with the values exposed by a target-field sample. */
export function compareFilterValueSamples(
    sourceValues: readonly string[],
    targetValues: readonly string[],
    exampleLimit=3
): FilterCompatibilityResult {
    const uniqueSource=Array.from(new Set(sourceValues));
    const uniqueTarget=new Set(targetValues);
    const missing=uniqueSource.filter(value => !uniqueTarget.has(value));
    const matchCount=uniqueSource.length-missing.length;
    return {
        matchCount,
        matchPercent: uniqueSource.length?Math.round(matchCount/uniqueSource.length*100):100,
        missingExamples: missing.slice(0, Math.max(0, exampleLimit)),
        sourceCount: uniqueSource.length,
        targetCount: uniqueTarget.size
    };
}
