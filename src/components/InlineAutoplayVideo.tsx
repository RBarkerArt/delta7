import React, { useEffect, useRef } from 'react';

interface InlineAutoplayVideoProps {
    src: string;
    className?: string;
    poster?: string;
    ariaLabel?: string;
    ariaHidden?: boolean;
    preload?: 'auto' | 'metadata' | 'none';
    disablePictureInPicture?: boolean;
    onReady?: () => void;
    onError?: () => void;
}

export const InlineAutoplayVideo: React.FC<InlineAutoplayVideoProps> = ({
    src,
    className,
    poster,
    ariaLabel,
    ariaHidden,
    preload = 'auto',
    disablePictureInPicture = true,
    onReady,
    onError,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const onReadyRef = useRef(onReady);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onReadyRef.current = onReady;
    }, [onReady]);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return undefined;

        let cancelled = false;
        let readySignaled = false;

        const signalReady = () => {
            if (cancelled || readySignaled) return;
            readySignaled = true;
            onReadyRef.current?.();
        };

        const attemptPlay = () => {
            if (cancelled || document.visibilityState === 'hidden') return;

            video.muted = true;
            video.defaultMuted = true;
            video.playsInline = true;

            void video.play()
                .then(signalReady)
                .catch(() => undefined);
        };

        const handleReady = () => {
            signalReady();
            attemptPlay();
        };

        const handleError = () => {
            if (!cancelled) onErrorRef.current?.();
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') attemptPlay();
        };

        video.pause();
        video.removeAttribute('src');
        video.load();
        video.muted = true;
        video.defaultMuted = true;
        video.autoplay = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = preload;
        video.crossOrigin = 'anonymous';
        video.setAttribute('muted', '');
        video.setAttribute('autoplay', '');
        video.setAttribute('loop', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.src = src;

        video.addEventListener('loadeddata', handleReady);
        video.addEventListener('canplay', handleReady);
        video.addEventListener('playing', handleReady);
        video.addEventListener('error', handleError);
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('pointerdown', attemptPlay);
        window.addEventListener('touchstart', attemptPlay, { passive: true });

        video.load();
        attemptPlay();

        return () => {
            cancelled = true;
            video.removeEventListener('loadeddata', handleReady);
            video.removeEventListener('canplay', handleReady);
            video.removeEventListener('playing', handleReady);
            video.removeEventListener('error', handleError);
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('pointerdown', attemptPlay);
            window.removeEventListener('touchstart', attemptPlay);
            video.pause();
            video.removeAttribute('src');
            video.load();
        };
    }, [preload, src]);

    return (
        <video
            ref={videoRef}
            className={className}
            poster={poster}
            muted
            autoPlay
            loop
            playsInline
            preload={preload}
            disablePictureInPicture={disablePictureInPicture}
            aria-label={ariaLabel}
            aria-hidden={ariaHidden}
        />
    );
};
