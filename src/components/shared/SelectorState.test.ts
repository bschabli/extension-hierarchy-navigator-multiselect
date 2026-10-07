import { Status } from '../API/Interfaces';
import { isSelectorUnavailable } from './SelectorState';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

assert(
    !isSelectorUnavailable(Status.notset),
    'A selector must remain interactive while the user still needs to choose an option.'
);
assert(!isSelectorUnavailable(Status.set), 'A configured selector must remain interactive.');
assert(!isSelectorUnavailable(undefined), 'A selector without a legacy status value must remain interactive.');
assert(isSelectorUnavailable(Status.notpossible), 'A selector without available options must be disabled.');
assert(isSelectorUnavailable(Status.hidden), 'A hidden selector must not be interactive.');

console.log('Selector state tests passed.');
