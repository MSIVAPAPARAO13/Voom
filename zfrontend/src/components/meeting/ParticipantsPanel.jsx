import React from 'react';
import {
    Box,
    Typography,
    IconButton,
    List,
    ListItem,
    ListItemAvatar,
    Avatar,
    ListItemText,
    ListItemSecondaryAction,
    Chip,
    Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import CheckIcon from '@mui/icons-material/Check';
import styles from '../../styles/videoComponent.module.css';

export default function ParticipantsPanel({
    open = false,
    onClose,
    participantsList = [],
    waitingParticipants = [],
    localSocketId,
    username = "You",
    isHost = false,
    onApproveWaiting,
    onRejectWaiting,
    onMuteParticipant,
    onRemoveParticipant
}) {
    if (!open) return null;

    return (
        <aside
            className={styles.sideDrawer}
            aria-label="Participants panel"
        >
            {/* Header */}
            <div
                style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#0b1020'
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
                        Participants
                    </Typography>
                    <Chip
                        label={participantsList.length || 1}
                        size="small"
                        color="primary"
                        sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            fontWeight: 700
                        }}
                    />
                </Box>
                <IconButton
                    size="small"
                    onClick={onClose}
                    aria-label="Close participants panel"
                    sx={{ color: '#94a3b8', '&:hover': { color: '#ffffff', bgcolor: 'rgba(255, 255, 255, 0.1)' } }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </div>

            {/* Scrollable list */}
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px'
                }}
            >
                {/* Host Waiting Room Queue */}
                {isHost && waitingParticipants && waitingParticipants.length > 0 && (
                    <Box
                        sx={{
                            mb: 2,
                            p: 1.5,
                            bgcolor: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '10px'
                        }}
                    >
                        <Typography variant="subtitle2" sx={{ color: '#fbbf24', fontWeight: 600, mb: 1, fontSize: '0.8rem' }}>
                            Waiting Room ({waitingParticipants.length})
                        </Typography>
                        <List dense disablePadding>
                            {waitingParticipants.map(p => (
                                <ListItem
                                    key={p.socketId}
                                    sx={{
                                        bgcolor: 'rgba(0, 0, 0, 0.2)',
                                        borderRadius: '6px',
                                        mb: 0.5,
                                        py: 0.5
                                    }}
                                >
                                    <ListItemText
                                        primary={p.username}
                                        primaryTypographyProps={{ sx: { color: '#f8fafc', fontSize: '0.82rem', fontWeight: 500 } }}
                                    />
                                    <ListItemSecondaryAction>
                                        <Tooltip title="Admit to meeting">
                                            <IconButton
                                                size="small"
                                                onClick={() => onApproveWaiting(p.socketId)}
                                                sx={{ color: '#34d399', mr: 0.5 }}
                                                aria-label={`Admit ${p.username}`}
                                            >
                                                <CheckIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Deny entry">
                                            <IconButton
                                                size="small"
                                                onClick={() => onRejectWaiting(p.socketId)}
                                                sx={{ color: '#f87171' }}
                                                aria-label={`Deny ${p.username}`}
                                            >
                                                <CloseIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                )}

                {/* In-Meeting Active Participants List */}
                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, px: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    In Meeting ({participantsList.length || 1})
                </Typography>

                <List dense sx={{ mt: 0.5 }}>
                    {participantsList.map(p => {
                        const isSelf = p.socketId === localSocketId;
                        const pName = p.username || (isSelf ? username : "Participant");
                        const initials = pName
                            .split(" ")
                            .map(n => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase() || "P";

                        return (
                            <ListItem
                                key={p.socketId}
                                sx={{
                                    py: 1,
                                    px: 1,
                                    borderRadius: '8px',
                                    mb: 0.5,
                                    bgcolor: isSelf ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                    border: isSelf ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent',
                                    '&:hover': {
                                        bgcolor: 'rgba(255, 255, 255, 0.04)'
                                    }
                                }}
                            >
                                <ListItemAvatar sx={{ minWidth: 38 }}>
                                    <Avatar
                                        sx={{
                                            width: 30,
                                            height: 30,
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            bgcolor: isSelf ? '#4f46e5' : '#1e293b',
                                            color: '#ffffff',
                                            border: '1px solid rgba(255, 255, 255, 0.15)'
                                        }}
                                    >
                                        {initials}
                                    </Avatar>
                                </ListItemAvatar>

                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                            <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.85rem' }}>
                                                {pName}
                                            </Typography>
                                            {isSelf && (
                                                <Chip
                                                    label="You"
                                                    size="small"
                                                    sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(99, 102, 241, 0.3)', color: '#c7d2fe' }}
                                                />
                                            )}
                                            {p.isHost && (
                                                <Chip
                                                    label="Host"
                                                    size="small"
                                                    sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7' }}
                                                />
                                            )}
                                        </Box>
                                    }
                                    secondary={
                                        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                                            {p.isMuted ? "Muted" : "Active audio"}
                                        </Typography>
                                    }
                                />

                                <ListItemSecondaryAction sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {/* Camera state icon */}
                                    {p.isVideoOff ? (
                                        <VideocamOffIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                                    ) : (
                                        <VideocamIcon sx={{ fontSize: 16, color: '#34d399' }} />
                                    )}

                                    {/* Mic state icon */}
                                    {p.isMuted ? (
                                        <MicOffIcon sx={{ fontSize: 16, color: '#f87171' }} />
                                    ) : (
                                        <MicIcon sx={{ fontSize: 16, color: '#34d399' }} />
                                    )}

                                    {/* Host Moderation Controls */}
                                    {isHost && !isSelf && (
                                        <>
                                            <Tooltip title="Mute Participant">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => onMuteParticipant(p.socketId)}
                                                    sx={{ color: '#94a3b8', '&:hover': { color: '#f87171' } }}
                                                    aria-label={`Mute ${pName}`}
                                                >
                                                    <MicOffIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Remove Participant">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => onRemoveParticipant(p.socketId)}
                                                    sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' } }}
                                                    aria-label={`Remove ${pName}`}
                                                >
                                                    <PersonRemoveIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </Tooltip>
                                        </>
                                    )}
                                </ListItemSecondaryAction>
                            </ListItem>
                        );
                    })}
                </List>
            </div>
        </aside>
    );
}
