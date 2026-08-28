type DelayHandle=unknown;
type ScheduleDelay=(callback: () => void, delayMs: number) => DelayHandle;
type CancelDelay=(handle: DelayHandle) => void;

const defaultScheduleDelay: ScheduleDelay=(callback, delayMs) => setTimeout(callback, delayMs);
const defaultCancelDelay: CancelDelay=handle => clearTimeout(handle as ReturnType<typeof setTimeout>);

/**
 * Wait for Tableau's initialization promise without imposing an application deadline.
 *
 * Tableau Cloud and the local sandbox can take longer to initialize while a
 * dashboard is loading. The delay callback is informational only; genuine
 * initialization failures continue to come from the Tableau Extensions API.
 */
export async function waitForTableauInitialization(
    initialize: () => Promise<void>,
    onDelayed: () => void,
    delayMs=15000,
    scheduleDelay: ScheduleDelay=defaultScheduleDelay,
    cancelDelay: CancelDelay=defaultCancelDelay
): Promise<void> {
    const delayHandle=scheduleDelay(onDelayed, delayMs);
    try {
        await initialize();
    }
    finally {
        cancelDelay(delayHandle);
    }
}
