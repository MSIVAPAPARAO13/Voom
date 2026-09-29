import React, { useState } from 'react';
import {
    Box,
    Typography,
    Chip,
    IconButton,
    Tooltip,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText
} from '@mui/material';
import VideoCameraFrontIcon from '@mui/icons-material/VideoCameraFront';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import MoreVertIcon from '@mui/icons-material/MoreVert';

export default function MeetingHeader({
    meetingTitle,
    meetingCode,
    participantCount = 1,
    isConnected = true,
    isHost = false,
    viewMode = "spotlight", // "spotlight" | "grid"
    onToggleViewMode,
    onOpenSettings,
    onOpenWorkspace,
    onOpenParticipants
}) {
    const [copied, setCopied] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <header
            style={{
                height: '60px',
                width: '100%',
                backgroundColor: '#0b1020',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 20px',
                zIndex: 20,
                boxSizing: 'border-box'
            }}
            role="banner"
        >
            {/* Left: Branding & Meeting Title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                {/* Voom Brand */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    <Box
                        sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.4)'
                        }}
                    >
                        <VideoCameraFrontIcon sx={{ fontSize: 18 }} />
                    </Box>
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            background: 'linear-gradient(135deg, #ffffff 0%, #c7d2fe 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            fontSize: '1.1rem',
                            display: { xs: 'none', sm: 'inline' }
                        }}
                    >
                        VOOM
                    </Typography>
                </Box>

                {/* Divider */}
                <Box
                    sx={{
                        width: '1px',
                        height: '20px',
                        bgcolor: 'rgba(255,255,255,0.15)',
                        display: { xs: 'none', sm: 'block' }
                    }}
                />

                {/* Meeting Title & Code */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
                    <Typography
                        variant="subtitle1"
                        noWrap
                        sx={{
                            fontWeight: 600,
                            color: '#f8fafc',
                            fontSize: '0.95rem',
                            maxWidth: { xs: 140, sm: 240, md: 340 }
                        }}
                        title={meetingTitle || `Meeting ${meetingCode}`}
                    >
                        {meetingTitle || `Meeting ${meetingCode}`}
                    </Typography>

                    {/* Copy Link Button */}
                    <Tooltip title={copied ? "Link Copied!" : "Copy Meeting Link"}>
                        <button
                            onClick={handleCopyLink}
                            aria-label="Copy meeting link"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: copied ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                                border: copied ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                color: copied ? '#34d399' : '#94a3b8',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                outline: 'none'
                            }}
                        >
                            {copied ? <CheckIcon sx={{ fontSize: 13 }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
                            <span style={{ fontFamily: 'monospace' }}>{meetingCode}</span>
                        </button>
                    </Tooltip>
                </Box>
            </Box>

            {/* Right: Participant count, Connection status & More actions */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
                {/* Participants Chip */}
                <Tooltip title="View Participants">
                    <Chip
                        icon={<PeopleOutlineIcon sx={{ fontSize: '15px !important', color: '#94a3b8 !important' }} />}
                        label={`${participantCount} ${participantCount === 1 ? 'participant' : 'participants'}`}
                        size="small"
                        onClick={onOpenParticipants}
                        clickable
                        sx={{
                            bgcolor: 'rgba(255, 255, 255, 0.05)',
                            color: '#e2e8f0',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            display: { xs: 'none', md: 'inline-flex' },
                            '&:hover': {
                                bgcolor: 'rgba(255, 255, 255, 0.1)',
                                borderColor: 'rgba(255, 255, 255, 0.2)'
                            }
                        }}
                    />
                </Tooltip>

                {/* Connection Status indicator */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '20px',
                        bgcolor: isConnected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                        border: isConnected ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)'
                    }}
                    role="status"
                    aria-label={isConnected ? "Connection status: Connected" : "Connection status: Connecting"}
                >
                    <Box
                        sx={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            bgcolor: isConnected ? '#10b981' : '#f59e0b',
                            boxShadow: isConnected ? '0 0 6px #10b981' : 'none'
                        }}
                    />
                    <Typography
                        variant="caption"
                        sx={{
                            color: isConnected ? '#34d399' : '#fbbf24',
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            letterSpacing: '0.02em',
                            display: { xs: 'none', sm: 'inline' }
                        }}
                    >
                        {isConnected ? "Connected" : "Connecting..."}
                    </Typography>
                </Box>

                {/* View Mode Toggle: Spotlight / Grid */}
                {onToggleViewMode && (
                    <Tooltip title={viewMode === "spotlight" ? "Switch to Grid View" : "Switch to Speaker View"}>
                        <IconButton
                            size="small"
                            onClick={onToggleViewMode}
                            aria-label={viewMode === "spotlight" ? "Switch to Grid View" : "Switch to Speaker View"}
                            sx={{
                                color: '#94a3b8',
                                bgcolor: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.12)', color: '#fff' }
                            }}
                        >
                            {viewMode === "spotlight" ? <GridViewIcon fontSize="small" /> : <ViewSidebarIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>
                )}

                {/* More Menu */}
                <IconButton
                    size="small"
                    onClick={(e) => setAnchorEl(e.currentTarget)}
                    aria-label="Meeting options menu"
                    sx={{
                        color: '#94a3b8',
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.12)', color: '#fff' }
                    }}
                >
                    <MoreVertIcon fontSize="small" />
                </IconButton>

                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={() => setAnchorEl(null)}
                    slotProps={{
                        paper: {
                            sx: {
                                bgcolor: '#111827',
                                color: '#f8fafc',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                                minWidth: 180
                            }
                        }
                    }}
                >
                    <MenuItem
                        onClick={() => {
                            setAnchorEl(null);
                            onOpenWorkspace();
                        }}
                    >
                        <ListItemIcon sx={{ color: '#818cf8' }}>
                            <AssignmentOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Workspace Notes" />
                    </MenuItem>

                    {isHost && (
                        <MenuItem
                            onClick={() => {
                                setAnchorEl(null);
                                onOpenSettings();
                            }}
                        >
                            <ListItemIcon sx={{ color: '#818cf8' }}>
                                <SettingsOutlinedIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary="Meeting Settings" />
                        </MenuItem>
                    )}
                </Menu>
            </Box>
        </header>
    );
}
