import { Typography } from '@mui/material';
import MicOffIcon from '@mui/icons-material/MicOff';
import MicIcon from '@mui/icons-material/Mic';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import styles from '../../styles/videoComponent.module.css';

export default function ParticipantFilmstrip({
    participants = [], // Array of { socketId, stream, participantInfo, isSpotlight }
    onSelectSpotlight
}) {
    if (!participants || participants.length === 0) return null;

    return (
        <div className={styles.filmstripContainer} role="region" aria-label="Participant Thumbnails">
            {participants.map((item) => {
                const info = item.participantInfo || {};
                const name = info.username || (item.isSelf ? "You" : "Participant");
                const isMuted = info.isMuted ?? false;
                const isVideoOff = info.isVideoOff ?? false;
                const initials = (name || "P")
                    .split(" ")
                    .map(n => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase() || "P";

                return (
                    <div
                        key={item.socketId || item.id}
                        className={`${styles.filmstripCard} ${item.isSpotlight ? styles.activeSpeaker : ''}`}
                        onClick={() => onSelectSpotlight && onSelectSpotlight(item.socketId)}
                        title={`Click to focus on ${name}`}
                    >
                        {/* Video Element */}
                        <video
                            ref={el => {
                                if (el && item.stream && el.srcObject !== item.stream) {
                                    el.srcObject = item.stream;
                                }
                            }}
                            autoPlay
                            playsInline
                            muted={item.isSelf}
                            className={styles.filmstripVideo}
                            style={{
                                display: isVideoOff ? 'none' : 'block'
                            }}
                        />

                        {/* Camera Off Placeholder */}
                        {isVideoOff && (
                            <div className={styles.cameraOffAvatarBox}>
                                <div className={styles.avatarInitialSmall}>
                                    {initials}
                                </div>
                                <VideocamOffIcon sx={{ fontSize: 14, color: '#94a3b8', mt: 0.5 }} />
                            </div>
                        )}

                        {/* Name & Mic pill */}
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '6px',
                                left: '6px',
                                right: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                background: 'rgba(15, 23, 42, 0.75)',
                                backdropFilter: 'blur(6px)',
                                border: '1px solid rgba(255, 255, 255, 0.08)'
                            }}
                        >
                            <Typography
                                variant="caption"
                                noWrap
                                sx={{
                                    color: '#f8fafc',
                                    fontWeight: 500,
                                    fontSize: '0.68rem',
                                    maxWidth: '110px'
                                }}
                            >
                                {name} {item.isSelf ? "(You)" : ""}
                            </Typography>

                            {isMuted ? (
                                <MicOffIcon sx={{ fontSize: 12, color: '#f87171' }} />
                            ) : (
                                <MicIcon sx={{ fontSize: 12, color: '#34d399' }} />
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
