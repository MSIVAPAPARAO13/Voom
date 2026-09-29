import React from 'react';
import {
    IconButton,
    Tooltip,
    Badge,
    CircularProgress
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
import styles from '../../styles/videoComponent.module.css';

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
    onToggleAudio,
    onToggleVideo,
    onToggleScreen,
    onToggleChat,
    onToggleParticipants,
    onToggleWorkspace,
    onStartRecording,
    onStopRecording,
    onOpenSettings,
    onEndCall
}) {
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

            {/* 4. Chat Toggle */}
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

            {/* 5. Participants Toggle */}
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

            {/* 6. Collaboration Workspace Toggle */}
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

            {/* 7. Recording Control (Host Only) */}
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

            {/* 8. Settings (Host Only) */}
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

            {/* 9. Leave Call (Destructive distinct action) */}
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
