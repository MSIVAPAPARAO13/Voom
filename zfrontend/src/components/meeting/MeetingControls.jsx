import React, { useState } from 'react';
import {
    IconButton,
    Tooltip,
    Badge,
    CircularProgress,
    Popover,
    Box,
    Typography,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Switch
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import CallEndIcon from '@mui/icons-material/CallEnd';
import AddReactionOutlinedIcon from '@mui/icons-material/AddReactionOutlined';
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined';
import styles from '../../styles/videoComponent.module.css';

const REACTION_EMOJIS = ["👍", "❤️", "😂", "👏", "🎉", "😮"];

export default function MeetingControls({
    video = true,
    audio = true,
    screen = false,
    screenAvailable = true,
    allowScreenShare = true,
    isHost = false,
    showChat = false,
    unreadMessages = 0,
    showParticipants = false,
    participantCount = 1,
    showWorkspace = false,
    isRecording = false,
    isFinalizingRecording = false,
    allowRecording = true,
    isHandRaised = false,
    isMeetingLocked = false,
    waitingRoomEnabled = false,
    allowChat = true,
    onToggleAudio,
    onToggleVideo,
    onToggleScreen,
    onToggleChat,
    onToggleParticipants,
    onToggleWorkspace,
    onStartRecording,
    onStopRecording,
    onOpenSettings,
    onSendReaction,
    onToggleRaiseHand,
    onToggleMeetingLock,
    onToggleWaitingRoom,
    onToggleAllowChat,
    onToggleAllowScreenShare,
    onOpenInfo,
    onEndCall
}) {
    const [reactionAnchorEl, setReactionAnchorEl] = useState(null);
    const [securityAnchorEl, setSecurityAnchorEl] = useState(null);

    // Button styling tokens
    const normalBtnStyle = {
        color: '#f1f5f9',
        bgcolor: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        width: 44,
        height: 44,
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.18)',
            transform: 'translateY(-2px)',
            borderColor: 'rgba(255, 255, 255, 0.25)'
        }
    };

    const activeBtnStyle = {
        color: '#ffffff',
        bgcolor: '#4f46e5',
        border: '1px solid #6366f1',
        width: 44,
        height: 44,
        boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
            bgcolor: '#4338ca',
            transform: 'translateY(-2px)'
        }
    };

    const goldenActiveBtnStyle = {
        color: '#ffffff',
        bgcolor: '#d97706',
        border: '1px solid #f59e0b',
        width: 44,
        height: 44,
        boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
            bgcolor: '#b45309',
            transform: 'translateY(-2px)'
        }
    };

    const dangerToggledBtnStyle = {
        color: '#ffffff',
        bgcolor: '#ef4444',
        border: '1px solid #f87171',
        width: 44,
        height: 44,
        boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
            bgcolor: '#dc2626',
            transform: 'translateY(-2px)'
        }
    };

    const endCallBtnStyle = {
        color: '#ffffff',
        bgcolor: '#e11d48',
        border: '1px solid #f43f5e',
        width: 52,
        height: 44,
        borderRadius: '22px',
        boxShadow: '0 4px 16px rgba(225, 29, 72, 0.4)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
            bgcolor: '#be123c',
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 20px rgba(225, 29, 72, 0.6)'
        }
    };

    const handleReactionClick = (emoji) => {
        if (onSendReaction) {
            onSendReaction(emoji);
        }
        setReactionAnchorEl(null);
    };

    return (
        <nav
            className={styles.controlBarDock}
            role="toolbar"
            aria-label="Meeting controls bar"
        >
            {/* 1. Microphone Toggle */}
            <Tooltip title={audio ? "Mute microphone" : "Unmute microphone"}>
                <IconButton
                    onClick={onToggleAudio}
                    aria-label={audio ? "Mute microphone" : "Unmute microphone"}
                    sx={audio ? normalBtnStyle : dangerToggledBtnStyle}
                >
                    {audio ? <MicIcon sx={{ fontSize: 20 }} /> : <MicOffIcon sx={{ fontSize: 20 }} />}
                </IconButton>
            </Tooltip>

            {/* 2. Camera Toggle */}
            <Tooltip title={video ? "Turn off camera" : "Turn on camera"}>
                <IconButton
                    onClick={onToggleVideo}
                    aria-label={video ? "Turn off camera" : "Turn on camera"}
                    sx={video ? normalBtnStyle : dangerToggledBtnStyle}
                >
                    {video ? <VideocamIcon sx={{ fontSize: 20 }} /> : <VideocamOffIcon sx={{ fontSize: 20 }} />}
                </IconButton>
            </Tooltip>

            {/* 3. Screen Share Toggle */}
            {screenAvailable && (isHost || allowScreenShare) && (
                <Tooltip title={screen ? "Stop sharing screen" : "Share screen"}>
                    <IconButton
                        onClick={onToggleScreen}
                        aria-label={screen ? "Stop sharing screen" : "Share screen"}
                        sx={screen ? activeBtnStyle : normalBtnStyle}
                    >
                        {screen ? <StopScreenShareIcon sx={{ fontSize: 20 }} /> : <ScreenShareIcon sx={{ fontSize: 20 }} />}
                    </IconButton>
                </Tooltip>
            )}

            {/* Divider */}
            <div style={{ width: 1, height: 26, background: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

            {/* 4. Reactions Button */}
            <Tooltip title="Reactions">
                <IconButton
                    onClick={(e) => setReactionAnchorEl(e.currentTarget)}
                    aria-label="Reactions"
                    sx={normalBtnStyle}
                >
                    <AddReactionOutlinedIcon sx={{ fontSize: 20 }} />
                </IconButton>
            </Tooltip>
            <Popover
                open={Boolean(reactionAnchorEl)}
                anchorEl={reactionAnchorEl}
                onClose={() => setReactionAnchorEl(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                PaperProps={{
                    sx: {
                        bgcolor: '#1e293b',
                        borderRadius: '24px',
                        p: 0.75,
                        display: 'flex',
                        gap: 1,
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        mb: 1.5
                    }
                }}
            >
                {REACTION_EMOJIS.map((emoji) => (
                    <IconButton
                        key={emoji}
                        size="small"
                        onClick={() => handleReactionClick(emoji)}
                        sx={{
                            fontSize: '1.4rem',
                            p: 0.5,
                            transition: 'transform 0.15s ease',
                            '&:hover': { transform: 'scale(1.3)', bgcolor: 'rgba(255, 255, 255, 0.1)' }
                        }}
                    >
                        {emoji}
                    </IconButton>
                ))}
            </Popover>

            {/* 5. Raise Hand Toggle */}
            <Tooltip title={isHandRaised ? "Lower hand" : "Raise hand"}>
                <IconButton
                    onClick={onToggleRaiseHand}
                    aria-label={isHandRaised ? "Lower hand" : "Raise hand"}
                    sx={isHandRaised ? goldenActiveBtnStyle : normalBtnStyle}
                >
                    <PanToolOutlinedIcon sx={{ fontSize: 20 }} />
                </IconButton>
            </Tooltip>

            {/* 6. Chat Toggle */}
            <Tooltip title={showChat ? "Close chat" : "Open chat"}>
                <IconButton
                    onClick={onToggleChat}
                    aria-label={showChat ? "Close chat" : "Open chat"}
                    sx={showChat ? activeBtnStyle : normalBtnStyle}
                >
                    <Badge badgeContent={unreadMessages} max={99} color="error">
                        <ChatBubbleOutlineIcon sx={{ fontSize: 20 }} />
                    </Badge>
                </IconButton>
            </Tooltip>

            {/* 7. Participants Toggle */}
            <Tooltip title={showParticipants ? "Hide participants" : "Show participants"}>
                <IconButton
                    onClick={onToggleParticipants}
                    aria-label={showParticipants ? "Hide participants" : "Show participants"}
                    sx={showParticipants ? activeBtnStyle : normalBtnStyle}
                >
                    <Badge badgeContent={participantCount} color="primary">
                        <PeopleAltOutlinedIcon sx={{ fontSize: 20 }} />
                    </Badge>
                </IconButton>
            </Tooltip>

            {/* 8. Host Security Menu */}
            {isHost && (
                <>
                    <Tooltip title="Security controls">
                        <IconButton
                            onClick={(e) => setSecurityAnchorEl(e.currentTarget)}
                            aria-label="Security controls"
                            sx={isMeetingLocked ? activeBtnStyle : normalBtnStyle}
                        >
                            <SecurityOutlinedIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                    </Tooltip>
                    <Menu
                        open={Boolean(securityAnchorEl)}
                        anchorEl={securityAnchorEl}
                        onClose={() => setSecurityAnchorEl(null)}
                        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                        PaperProps={{
                            sx: {
                                bgcolor: '#111827',
                                color: '#f8fafc',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                borderRadius: '12px',
                                minWidth: 260,
                                mb: 1.5,
                                p: 1
                            }
                        }}
                    >
                        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                                Host Security Controls
                            </Typography>
                        </Box>
                        <MenuItem onClick={onToggleMeetingLock}>
                            <ListItemIcon sx={{ color: isMeetingLocked ? '#ef4444' : '#94a3b8' }}>
                                <LockOutlinedIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary="Lock Meeting" secondary={isMeetingLocked ? "New attendees blocked" : "Open for join"} secondaryTypographyProps={{ sx: { fontSize: '0.72rem', color: '#64748b' } }} />
                            <Switch checked={isMeetingLocked} size="small" />
                        </MenuItem>
                        <MenuItem onClick={onToggleWaitingRoom}>
                            <ListItemIcon sx={{ color: waitingRoomEnabled ? '#3b82f6' : '#94a3b8' }}>
                                <MeetingRoomOutlinedIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary="Waiting Room" secondary={waitingRoomEnabled ? "Admission required" : "Direct join"} secondaryTypographyProps={{ sx: { fontSize: '0.72rem', color: '#64748b' } }} />
                            <Switch checked={waitingRoomEnabled} size="small" />
                        </MenuItem>
                        <MenuItem onClick={onToggleAllowScreenShare}>
                            <ListItemText inset primary="Allow Screen Share" />
                            <Switch checked={allowScreenShare} size="small" />
                        </MenuItem>
                        <MenuItem onClick={onToggleAllowChat}>
                            <ListItemText inset primary="Allow Room Chat" />
                            <Switch checked={allowChat} size="small" />
                        </MenuItem>
                    </Menu>
                </>
            )}

            {/* 9. Meeting Info Button */}
            {onOpenInfo && (
                <Tooltip title="Meeting info">
                    <IconButton
                        onClick={onOpenInfo}
                        aria-label="Meeting info"
                        sx={normalBtnStyle}
                    >
                        <InfoOutlinedIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                </Tooltip>
            )}

            {/* 10. Collaboration Workspace Toggle */}
            {onToggleWorkspace && (
                <Tooltip title={showWorkspace ? "Close workspace" : "Open workspace (Notes, Tasks, Agenda)"}>
                    <IconButton
                        onClick={onToggleWorkspace}
                        aria-label={showWorkspace ? "Close workspace" : "Open workspace"}
                        sx={showWorkspace ? activeBtnStyle : normalBtnStyle}
                    >
                        <AssignmentOutlinedIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                </Tooltip>
            )}

            {/* 11. Recording Control (Host Only) */}
            {isHost && allowRecording && (
                <Tooltip title={isRecording ? "Stop recording" : isFinalizingRecording ? "Finalizing recording..." : "Start recording"}>
                    <span>
                        <IconButton
                            onClick={isRecording ? onStopRecording : onStartRecording}
                            disabled={isFinalizingRecording}
                            aria-label={isRecording ? "Stop recording" : "Start recording"}
                            sx={isRecording ? dangerToggledBtnStyle : normalBtnStyle}
                        >
                            {isFinalizingRecording ? (
                                <CircularProgress size={20} color="inherit" />
                            ) : isRecording ? (
                                <StopCircleIcon sx={{ fontSize: 22 }} />
                            ) : (
                                <FiberManualRecordIcon sx={{ fontSize: 20, color: '#f87171' }} />
                            )}
                        </IconButton>
                    </span>
                </Tooltip>
            )}

            {/* 12. Settings (Host Only) */}
            {isHost && onOpenSettings && (
                <Tooltip title="Meeting settings">
                    <IconButton
                        onClick={onOpenSettings}
                        aria-label="Meeting settings"
                        sx={normalBtnStyle}
                    >
                        <SettingsOutlinedIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                </Tooltip>
            )}

            {/* Divider */}
            <div style={{ width: 1, height: 26, background: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

            {/* 13. Leave Call */}
            <Tooltip title="Leave meeting">
                <IconButton
                    onClick={onEndCall}
                    aria-label="Leave meeting"
                    sx={endCallBtnStyle}
                >
                    <CallEndIcon sx={{ fontSize: 22 }} />
                </IconButton>
            </Tooltip>
        </nav>
    );
}
