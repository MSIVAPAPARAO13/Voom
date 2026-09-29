import React from 'react';
import { Box, Typography } from '@mui/material';
import MicOffIcon from '@mui/icons-material/MicOff';
import MicIcon from '@mui/icons-material/Mic';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import styles from '../../styles/videoComponent.module.css';

export default function FloatingSelfView({
    localVideoref,
    video = true,
    audio = true,
    username = "You",
    isHost = false,
    onClick
}) {
    const initials = (username || "You")
        .split(" ")
        .map(n => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "Y";

    return (
        <div
            className={styles.floatingSelfView}
            onClick={onClick}
            title={`${username} (Self View)`}
            role="region"
            aria-label="Your camera preview"
        >
            {/* Video element - always rendered so stream track binds properly */}
            <video
                ref={el => {
                    if (localVideoref) {
                        localVideoref.current = el;
                        if (el && window.localStream && el.srcObject !== window.localStream) {
                            el.srcObject = window.localStream;
                        }
                    }
                }}
                autoPlay
                muted
                playsInline
                className={styles.selfVideoElement}
                style={{
                    display: video ? 'block' : 'none'
                }}
            />

            {/* Camera Off Avatar Fallback */}
            {!video && (
                <div className={styles.cameraOffAvatarBox}>
                    <div className={styles.avatarInitialSmall}>
                        {initials}
                    </div>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
                        <VideocamOffIcon sx={{ fontSize: 13, color: '#94a3b8' }} />
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '10px' }}>
                            Camera Off
                        </Typography>
                    </Box>
                </div>
            )}

            {/* Info Pill Bottom Left: Name & Mic status */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    right: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '3px 8px',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    pointerEvents: 'none'
                }}
            >
                <Typography
                    variant="caption"
                    noWrap
                    sx={{
                        color: '#f8fafc',
                        fontWeight: 600,
                        fontSize: '0.72rem',
                        maxWidth: '120px'
                    }}
                >
                    {username} (You)
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {!audio ? (
                        <MicOffIcon sx={{ fontSize: 13, color: '#f87171' }} />
                    ) : (
                        <MicIcon sx={{ fontSize: 13, color: '#34d399' }} />
                    )}
                </Box>
            </div>
        </div>
    );
}
