import React, { useState } from 'react';
import {
    Box,
    Typography,
    Button,
    Chip
} from '@mui/material';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import MicOffIcon from '@mui/icons-material/MicOff';
import MicIcon from '@mui/icons-material/Mic';
import FloatingSelfView from './FloatingSelfView';
import ParticipantFilmstrip from './ParticipantFilmstrip';
import styles from '../../styles/videoComponent.module.css';

export default function MeetingStage({
    localVideoref,
    video = true,
    audio = true,
    screen = false,
    onStopScreenShare,
    username = "You",
    isHost = false,
    videos = [], // Remote participant stream objects: [{ socketId, stream }]
    participantsList = [], // Metadata objects from socket: [{ socketId, username, isMuted, isVideoOff, isHost }]
    viewMode = "spotlight", // "spotlight" | "grid"
    spotlightSocketId = null,
    onSetSpotlightSocketId,
    presenterSocketId = null,
    presenterName = "",
    activeSpeakerSocketId = null,
    activeReactions = {},
    raisedHands = [],
    isHandRaised = false
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Helper to find participant metadata by socketId
    const getParticipantInfo = (socketId) => {
        return participantsList.find(p => p.socketId === socketId) || { username: "Participant" };
    };

    const selfInitials = (username || "You")
        .split(" ")
        .map(n => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "Y";

    // 0. Remote Screen Sharing Active State
    const isRemoteScreenSharing = Boolean(presenterSocketId && presenterSocketId !== "self");
    const presenterVideo = isRemoteScreenSharing ? videos.find(v => v.socketId === presenterSocketId) : null;

    if (isRemoteScreenSharing && presenterVideo) {
        return (
            <div className={styles.stageArea}>
                {/* Banner: [Presenter Name] is presenting */}
                <div className={styles.screenShareBanner} style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600, fontSize: '0.85rem' }}>
                        {presenterName || "A participant"} is presenting
                    </Typography>
                </div>

                {/* Main Remote Screen Share View */}
                <div className={styles.stageCanvas}>
                    <div className={styles.mainVideoWrapper}>
                        <video
                            ref={el => {
                                if (el && presenterVideo.stream && el.srcObject !== presenterVideo.stream) {
                                    el.srcObject = presenterVideo.stream;
                                }
                            }}
                            autoPlay
                            playsInline
                            className={styles.mainVideoElement}
                        />
                    </div>

                    {/* Floating Self Preview */}
                    <FloatingSelfView
                        localVideoref={localVideoref}
                        video={video}
                        audio={audio}
                        username={username}
                        isHost={isHost}
                    />
                </div>

                {/* Remote Participants Filmstrip at the bottom */}
                {videos.length > 0 && (
                    <ParticipantFilmstrip
                        participants={videos.map(v => ({
                            socketId: v.socketId,
                            stream: v.stream,
                            participantInfo: getParticipantInfo(v.socketId),
                            isSpotlight: v.socketId === presenterSocketId
                        }))}
                        onSelectSpotlight={onSetSpotlightSocketId}
                    />
                )}
            </div>
        );
    }

    // 1. Screen Sharing Active State
    if (screen) {
        return (
            <div className={styles.stageArea}>
                {/* Banner: You are sharing your screen */}
                <div className={styles.screenShareBanner}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#3b82f6', boxShadow: '0 0 8px #3b82f6' }} />
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600, fontSize: '0.85rem' }}>
                        You are sharing your screen
                    </Typography>
                    <Button
                        size="small"
                        variant="contained"
                        color="error"
                        startIcon={<StopScreenShareIcon sx={{ fontSize: 16 }} />}
                        onClick={onStopScreenShare}
                        sx={{
                            borderRadius: '16px',
                            textTransform: 'none',
                            py: 0.25,
                            px: 1.5,
                            fontSize: '0.78rem',
                            fontWeight: 600
                        }}
                    >
                        Stop Sharing
                    </Button>
                </div>

                {/* Main Screen Share View */}
                <div className={styles.stageCanvas}>
                    <div className={styles.mainVideoWrapper}>
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
                            className={styles.mainVideoElement}
                        />
                    </div>

                    {/* Floating Self Preview while sharing screen */}
                    <FloatingSelfView
                        localVideoref={null} // Don't steal ref while sharing screen
                        video={video}
                        audio={audio}
                        username={username}
                        isHost={isHost}
                    />
                </div>

                {/* Remote Participants Filmstrip at the bottom */}
                {videos.length > 0 && (
                    <ParticipantFilmstrip
                        participants={videos.map(v => ({
                            socketId: v.socketId,
                            stream: v.stream,
                            participantInfo: getParticipantInfo(v.socketId),
                            isSpotlight: false
                        }))}
                        onSelectSpotlight={onSetSpotlightSocketId}
                    />
                )}
            </div>
        );
    }

    // 2. Single Participant Meeting (Only local user in meeting)
    if (videos.length === 0) {
        return (
            <div className={styles.stageArea}>
                <div className={styles.stageCanvas}>
                    <div className={styles.mainVideoWrapper}>
                        {/* Large Self Video on Stage */}
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
                            className={styles.mainVideoElementCover}
                            style={{
                                display: video ? 'block' : 'none',
                                transform: 'scaleX(-1)' // Mirror local view
                            }}
                        />

                        {/* Camera Off Avatar Fallback */}
                        {!video && (
                            <div className={styles.cameraOffAvatarBox}>
                                <div className={styles.avatarInitialCircle}>
                                    {selfInitials}
                                </div>
                                <Typography variant="h6" sx={{ mt: 2, color: '#f8fafc', fontWeight: 600 }}>
                                    {username} (You)
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, color: '#94a3b8' }}>
                                    <VideocamOffIcon sx={{ fontSize: 16 }} />
                                    <Typography variant="body2">Camera is turned off</Typography>
                                </Box>
                            </div>
                        )}

                        {/* Name & Mic overlay badge */}
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '16px',
                                left: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 14px',
                                borderRadius: '10px',
                                background: 'rgba(15, 23, 42, 0.75)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255, 255, 255, 0.12)'
                            }}
                        >
                            <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.85rem' }}>
                                {username} (You)
                            </Typography>
                            {isHost && (
                                <Chip label="Host" size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem' }} />
                            )}
                            {!audio ? (
                                <MicOffIcon sx={{ fontSize: 16, color: '#f87171' }} />
                            ) : (
                                <MicIcon sx={{ fontSize: 16, color: '#34d399' }} />
                            )}
                        </div>

                        {/* Hand Raised Indicator */}
                        {isHandRaised && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '20px',
                                    right: '20px',
                                    background: 'rgba(245, 158, 11, 0.95)',
                                    color: '#ffffff',
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 4px 16px rgba(245, 158, 11, 0.5)',
                                    zIndex: 10
                                }}
                            >
                                <span style={{ fontSize: '18px' }}>✋</span>
                                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>Hand Raised</Typography>
                            </div>
                        )}

                        {/* Floating Reaction Overlay */}
                        {activeReactions['self'] && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    fontSize: '4.5rem',
                                    zIndex: 20,
                                    pointerEvents: 'none',
                                    filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))'
                                }}
                            >
                                {activeReactions['self']}
                            </div>
                        )}

                        {/* Glass Pill: Waiting for others to join */}
                        <div
                            style={{
                                position: 'absolute',
                                top: '20px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '8px 18px',
                                borderRadius: '30px',
                                background: 'rgba(15, 23, 42, 0.8)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                            }}
                        >
                            <Typography variant="body2" sx={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 500 }}>
                                You're the only one here
                            </Typography>
                            <Button
                                size="small"
                                onClick={handleCopy}
                                startIcon={copied ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
                                sx={{
                                    bgcolor: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                                    color: copied ? '#34d399' : '#a5b4fc',
                                    border: '1px solid',
                                    borderColor: copied ? 'rgba(16, 185, 129, 0.4)' : 'rgba(99, 102, 241, 0.4)',
                                    borderRadius: '16px',
                                    textTransform: 'none',
                                    py: 0.2,
                                    px: 1.2,
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    '&:hover': {
                                        bgcolor: 'rgba(99, 102, 241, 0.3)'
                                    }
                                }}
                            >
                                {copied ? "Copied Link" : "Copy Invite"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 3. Grid View Mode (Multiple participants balanced in a responsive grid)
    if (viewMode === "grid" && videos.length > 0) {
        const allStreams = [
            { isSelf: true, socketId: "self", username, stream: null, isMuted: !audio, isVideoOff: !video },
            ...videos.map(v => {
                const info = getParticipantInfo(v.socketId);
                return { isSelf: false, socketId: v.socketId, stream: v.stream, username: info.username, isMuted: info.isMuted, isVideoOff: info.isVideoOff };
            })
        ];

        return (
            <div className={styles.stageArea}>
                <div
                    style={{
                        flex: 1,
                        width: '100%',
                        height: '100%',
                        display: 'grid',
                        gridTemplateColumns: allStreams.length === 2 ? 'repeat(2, 1fr)' : allStreams.length <= 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                        gap: '12px',
                        overflow: 'hidden',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    {allStreams.map(item => {
                        const initials = (item.username || "P")
                            .split(" ")
                            .map(n => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase() || "P";
                        const isSpeaking = activeSpeakerSocketId === item.socketId || (item.isSelf && activeSpeakerSocketId === "self");

                        return (
                            <div
                                key={item.socketId}
                                className={styles.mainVideoWrapper}
                                style={{
                                    height: '100%',
                                    borderRadius: '12px',
                                    border: isSpeaking ? '2px solid #ff9839' : '1px solid rgba(255, 255, 255, 0.1)',
                                    boxShadow: isSpeaking ? '0 0 16px rgba(255, 152, 57, 0.6)' : 'none',
                                    transition: 'border 0.2s ease, box-shadow 0.2s ease'
                                }}
                            >
                                {item.isSelf ? (
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
                                        className={styles.mainVideoElementCover}
                                        style={{ display: item.isVideoOff ? 'none' : 'block', transform: 'scaleX(-1)' }}
                                    />
                                ) : (
                                    <video
                                        ref={el => {
                                            if (el && item.stream && el.srcObject !== item.stream) {
                                                el.srcObject = item.stream;
                                            }
                                        }}
                                        autoPlay
                                        playsInline
                                        className={styles.mainVideoElementCover}
                                        style={{ display: item.isVideoOff ? 'none' : 'block' }}
                                    />
                                )}

                                {item.isVideoOff && (
                                    <div className={styles.cameraOffAvatarBox}>
                                        <div className={styles.avatarInitialCircle}>
                                            {initials}
                                        </div>
                                    </div>
                                )}

                                {/* Hand Raised Badge on Tile */}
                                {((item.isSelf && isHandRaised) || raisedHands.includes(item.socketId) || item.isHandRaised) && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: '10px',
                                            right: '10px',
                                            background: 'rgba(245, 158, 11, 0.95)',
                                            color: '#ffffff',
                                            padding: '3px 8px',
                                            borderRadius: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                                            zIndex: 10
                                        }}
                                    >
                                        <span style={{ fontSize: '13px' }}>✋</span>
                                        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.68rem' }}>Raised</Typography>
                                    </div>
                                )}

                                {/* Floating Reaction Overlay */}
                                {(activeReactions[item.socketId] || (item.isSelf && activeReactions['self'])) && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            fontSize: '3.5rem',
                                            zIndex: 20,
                                            pointerEvents: 'none',
                                            filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.6))'
                                        }}
                                    >
                                        {activeReactions[item.socketId] || (item.isSelf && activeReactions['self'])}
                                    </div>
                                )}

                                <div
                                    style={{
                                        position: 'absolute',
                                        bottom: '12px',
                                        left: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                        background: 'rgba(15, 23, 42, 0.75)',
                                        backdropFilter: 'blur(8px)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)'
                                    }}
                                >
                                    <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 600 }}>
                                        {item.username} {item.isSelf ? "(You)" : ""}
                                    </Typography>
                                    {item.isMuted ? (
                                        <MicOffIcon sx={{ fontSize: 13, color: '#f87171' }} />
                                    ) : (
                                        <MicIcon sx={{ fontSize: 13, color: '#34d399' }} />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // 4. Spotlight / Active Speaker Mode (Target layout: Main participant on Stage + Floating Self View + Filmstrip)
    // Determine active spotlight remote participant
    const activeRemoteVideo = videos.find(v => v.socketId === spotlightSocketId) || videos[0];
    const remoteInfo = activeRemoteVideo ? getParticipantInfo(activeRemoteVideo.socketId) : null;
    const remoteName = remoteInfo?.username || "Participant";
    const remoteInitials = remoteName
        .split(" ")
        .map(n => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "P";
    const remoteVideoOff = remoteInfo?.isVideoOff ?? false;
    const remoteMuted = remoteInfo?.isMuted ?? false;
    const isRemoteSpeaking = activeSpeakerSocketId === activeRemoteVideo?.socketId;

    // Remaining participants for the filmstrip (if more than 1 remote)
    const filmstripParticipants = videos.map(v => ({
        socketId: v.socketId,
        stream: v.stream,
        participantInfo: getParticipantInfo(v.socketId),
        isSpotlight: v.socketId === activeRemoteVideo?.socketId
    }));

    return (
        <div className={styles.stageArea}>
            <div className={styles.stageCanvas}>
                {/* Active Main Video */}
                <div
                    className={styles.mainVideoWrapper}
                    style={{
                        borderRadius: '16px',
                        border: isRemoteSpeaking ? '2px solid #ff9839' : '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: isRemoteSpeaking ? '0 0 20px rgba(255, 152, 57, 0.6)' : 'none',
                        transition: 'border 0.2s ease, box-shadow 0.2s ease'
                    }}
                >
                    {activeRemoteVideo && (
                        <video
                            data-socket={activeRemoteVideo.socketId}
                            ref={el => {
                                if (el && activeRemoteVideo.stream && el.srcObject !== activeRemoteVideo.stream) {
                                    el.srcObject = activeRemoteVideo.stream;
                                }
                            }}
                            autoPlay
                            playsInline
                            className={styles.mainVideoElementCover}
                            style={{
                                display: remoteVideoOff ? 'none' : 'block'
                            }}
                        />
                    )}

                    {/* Camera Off Avatar for active remote */}
                    {remoteVideoOff && (
                        <div className={styles.cameraOffAvatarBox}>
                            <div className={styles.avatarInitialCircle}>
                                {remoteInitials}
                            </div>
                            <Typography variant="h6" sx={{ mt: 2, color: '#f8fafc', fontWeight: 600 }}>
                                {remoteName}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, color: '#94a3b8' }}>
                                <VideocamOffIcon sx={{ fontSize: 16 }} />
                                <Typography variant="body2">Camera is turned off</Typography>
                            </Box>
                        </div>
                    )}

                    {/* Active Remote Info Badge */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '16px',
                            left: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 14px',
                            borderRadius: '10px',
                            background: 'rgba(15, 23, 42, 0.75)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.12)'
                        }}
                    >
                        <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.85rem' }}>
                            {remoteName}
                        </Typography>
                        {remoteInfo?.isHost && (
                            <Chip label="Host" size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem' }} />
                        )}
                        {remoteMuted ? (
                            <MicOffIcon sx={{ fontSize: 16, color: '#f87171' }} />
                        ) : (
                            <MicIcon sx={{ fontSize: 16, color: '#34d399' }} />
                        )}
                    </div>
                </div>

                {/* Floating Self View (Picture-in-Picture) */}
                <FloatingSelfView
                    localVideoref={localVideoref}
                    video={video}
                    audio={audio}
                    username={username}
                    isHost={isHost}
                />
            </div>

            {/* Filmstrip at bottom if 2 or more remote participants */}
            {videos.length > 1 && (
                <ParticipantFilmstrip
                    participants={filmstripParticipants}
                    onSelectSpotlight={onSetSpotlightSocketId}
                />
            )}
        </div>
    );
}
