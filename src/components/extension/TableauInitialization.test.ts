import { waitForTableauInitialization } from './TableauInitialization';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

async function run(): Promise<void> {
    let resolveInitialization: (() => void)|undefined;
    let delayCallback: (() => void)|undefined;
    const delayState={shown:false};
    let cancelledHandle: unknown;
    const initialization=new Promise<void>(resolve => {
        resolveInitialization=resolve;
    });

    const waiting=waitForTableauInitialization(
        () => initialization,
        () => { delayState.shown=true; },
        15000,
        callback => {
            delayCallback=callback;
            return 17;
        },
        handle => { cancelledHandle=handle; }
    );

    assert(delayState.shown===false, 'delay notice should not be immediate');
    delayCallback!();
    assert(delayState.shown===true, 'delay notice should not reject initialization');
    resolveInitialization!();
    await waiting;
    assert(cancelledHandle===17, 'delay notice timer should be cleared');

    const expectedError=new Error('Tableau rejected initialization');
    let receivedError: unknown;
    try {
        await waitForTableauInitialization(
            () => Promise.reject(expectedError),
            () => undefined,
            15000,
            () => 23,
            handle => { cancelledHandle=handle; }
        );
    }
    catch(error) {
        receivedError=error;
    }
    assert(receivedError===expectedError, 'Tableau API errors should still be propagated');
    assert(cancelledHandle===23, 'delay timer should be cleared after an API error');

    console.log('Tableau initialization tests passed.');
}

run().catch(error => {
    console.error(error);
    process.exitCode=1;
});
