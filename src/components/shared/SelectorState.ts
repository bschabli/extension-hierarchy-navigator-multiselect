import { Status } from '../API/Interfaces';

/** Return whether a selector has no available interaction in its current state. */
export function isSelectorUnavailable(status?: Status): boolean {
    return status===Status.notpossible||status===Status.hidden;
}
