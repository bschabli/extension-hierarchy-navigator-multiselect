interface LoadingOverlayProps {
    detail?: string;
    label: string;
}

export function LoadingOverlay(props: LoadingOverlayProps) {
    return (
        <div aria-busy='true' aria-live='polite' className='loading-overlay' role='status'>
            <div className='loading-panel'>
                <span aria-hidden='true' className='loading-spinner' />
                <strong className='loading-label'>{props.label}</strong>
                {props.detail ? <p className='initialization-delay-notice'>{props.detail}</p> : undefined}
            </div>
        </div>
    );
}
