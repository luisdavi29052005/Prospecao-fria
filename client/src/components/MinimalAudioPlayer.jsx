import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

const MinimalAudioPlayer = ({ src, incoming = false }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef(null);

    // Simulate waveform bars (random heights for visual effect)
    const [waveform] = useState(() => Array.from({ length: 24 }, () => Math.floor(Math.random() * 60) + 20));

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleLoadedMetadata = () => setDuration(audio.duration);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    const formatTime = (time) => {
        if (!time) return '0:00';
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 4px',
            width: '100%',
            maxWidth: '260px'
        }}>
            <audio ref={audioRef} src={src} style={{ display: 'none' }} />

            <button
                onClick={togglePlay}
                style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: incoming ? 'var(--bg-tertiary)' : 'rgba(255,255,255,0.2)',
                    color: incoming ? 'var(--text-primary)' : '#ffffff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0
                }}
            >
                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            </button>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '3px', height: '24px' }}>
                {waveform.map((height, i) => {
                    const progress = (currentTime / duration) * 24;
                    const isActive = i < progress;
                    return (
                        <div
                            key={i}
                            style={{
                                width: '3px',
                                height: `${height}%`,
                                background: incoming
                                    ? (isActive ? 'var(--primary)' : '#cbd5e1')
                                    : (isActive ? '#ffffff' : 'rgba(255,255,255,0.4)'),
                                borderRadius: '2px',
                                transition: 'all 0.1s'
                            }}
                        />
                    );
                })}
            </div>

            <span style={{
                fontSize: '11px',
                fontWeight: 500,
                color: incoming ? 'var(--text-secondary)' : 'rgba(255,255,255,0.8)',
                minWidth: '35px',
                textAlign: 'right'
            }}>
                {formatTime(currentTime || duration)}
            </span>
        </div>
    );
};

export default MinimalAudioPlayer;
