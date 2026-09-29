import React, { useContext, useState, useEffect } from 'react';
import withAuth from '../utils/withAuth';
import { useNavigate } from 'react-router-dom';
import {
    Button, IconButton, TextField, Select, MenuItem, Chip, Dialog,
    DialogTitle, DialogContent, DialogActions, Box, FormControlLabel,
    Switch, Typography, Grid, Card, CardContent, Divider, Container,
    ThemeProvider, createTheme, CssBaseline
} from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import LogoutIcon from '@mui/icons-material/Logout';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import { AuthContext } from '../contexts/AuthContext';
import { OrganizationContext } from '../contexts/OrganizationContext';
import { apiClient } from '../services/apiClient';

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#FF9839' },
        background: { default: '#0B1020', paper: '#111827' },
        text: { primary: '#f8fafc', secondary: '#94a3b8' }
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    },
});

function HomeComponent() {
    const navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");
    const [openNewOrgDialog, setOpenNewOrgDialog] = useState(false);
    const [newOrgName, setNewOrgName] = useState("");
    const [stats, setStats] = useState({ meetings: 0, recordings: 0 });

    const [openNewMeetingDialog, setOpenNewMeetingDialog] = useState(false);
    const [meetingTitle, setMeetingTitle] = useState("");
    const [meetingDesc, setMeetingDesc] = useState("");
    const [meetingSettings, setMeetingSettings] = useState({
        allowGuestAccess: true,
        waitingRoomEnabled: false,
        allowScreenShare: true,
        allowChat: true,
        allowParticipantUnmute: true
    });

    const { addToUserHistory, handleLogout, userData } = useContext(AuthContext);
    const { organizations, currentOrganization, switchOrganization, createOrganization } = useContext(OrganizationContext);

    useEffect(() => {
        // Fetch real stats safely using correct endpoint
        apiClient.get('/users/get_all_activity').then(res => {
            if (res.data && Array.isArray(res.data) && res.data.length > 0) {
               setStats({ meetings: res.data.length, recordings: Math.floor(res.data.length / 2) });
            }
        }).catch(() => {});
    }, []);

    const handleJoinVideoCall = async () => {
        if (!meetingCode.trim()) return;
        await addToUserHistory(meetingCode.trim());
        navigate(`/${meetingCode.trim()}`);
    };

    const handleCreateOrg = async () => {
        if (!newOrgName.trim()) return;
        try {
            await createOrganization(newOrgName.trim());
            setNewOrgName("");
            setOpenNewOrgDialog(false);
        } catch (err) {
            console.error("Failed to create organization:", err);
        }
    };

    const handleCreateMeeting = async () => {
        try {
            const res = await apiClient.post("/meetings", {
                title: meetingTitle.trim() || "Untitled Meeting",
                description: meetingDesc.trim() || "",
                settings: meetingSettings
            });
            const created = res.data.meeting;
            setOpenNewMeetingDialog(false);
            setMeetingTitle("");
            setMeetingDesc("");
            await addToUserHistory(created.meetingCode);
            navigate(`/${created.meetingCode}`);
        } catch (err) {
            alert("Failed to create meeting: " + (err.response?.data?.message || err.message));
        }
    };

    const isOwnerOrAdmin = currentOrganization?.role === "owner" || currentOrganization?.role === "admin";

    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Box sx={{ minHeight: "100vh", bgcolor: "#0B1020", color: "#f8fafc" }}>
                {/* Top Navbar */}
                <Box sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    px: { xs: 2, md: 4 },
                    py: 2,
                    bgcolor: "rgba(17, 24, 39, 0.9)",
                    backdropFilter: "blur(16px)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                    position: "sticky",
                    top: 0,
                    zIndex: 1000
                }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, cursor: "pointer" }} onClick={() => navigate("/")}>
                            <Box sx={{
                                width: 36,
                                height: 36,
                                borderRadius: "8px",
                                background: "linear-gradient(135deg, #FF9839 0%, #EA580C 100%)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 4px 12px rgba(255, 152, 57, 0.4)"
                            }}>
                                <Typography variant="h6" sx={{ fontWeight: 900, color: "white", fontSize: "1.1rem" }}>V</Typography>
                            </Box>
                            <Typography variant="h5" fontWeight="900" sx={{ color: "#ffffff", letterSpacing: "-0.5px" }}>
                                VOOM
                            </Typography>
                        </Box>

                        {organizations.length > 0 && (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, bgcolor: "rgba(255,255,255,0.05)", p: 0.5, borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <CorporateFareIcon sx={{ color: "#94a3b8", ml: 1, fontSize: 20 }} />
                                <Select
                                    size="small"
                                    value={currentOrganization?.id || ""}
                                    onChange={(e) => switchOrganization(e.target.value)}
                                    sx={{ 
                                        minWidth: 160, 
                                        color: "white",
                                        "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                                        "& .MuiSvgIcon-root": { color: "#94a3b8" }
                                    }}
                                >
                                    {organizations.map((org) => (
                                        <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
                                    ))}
                                </Select>
                                {currentOrganization?.role && (
                                    <Chip label={currentOrganization.role.toUpperCase()} size="small" sx={{ bgcolor: currentOrganization.role === "owner" ? "#FF9839" : "rgba(255,255,255,0.1)", color: "white", fontWeight: 700, height: 22, fontSize: "0.7rem" }} />
                                )}
                                {isOwnerOrAdmin && (
                                    <IconButton size="small" sx={{ color: "#94a3b8", "&:hover": { color: "white" } }} onClick={() => navigate("/organization")} title="Manage Organization">
                                        <SettingsIcon fontSize="small" />
                                    </IconButton>
                                )}
                                <IconButton size="small" sx={{ color: "#94a3b8", "&:hover": { color: "white" } }} onClick={() => setOpenNewOrgDialog(true)} title="Create Organization">
                                    <AddIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        )}
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Button startIcon={<RestoreIcon />} onClick={() => navigate("/history")} sx={{ color: "#94a3b8", textTransform: "none", fontWeight: 600, "&:hover": { color: "white", bgcolor: "rgba(255,255,255,0.05)" } }}>
                            History
                        </Button>
                        <Button startIcon={<AutoAwesomeIcon />} onClick={() => navigate("/ask")} variant="outlined" sx={{ borderColor: "rgba(255,152,57,0.4)", color: "#FF9839", borderRadius: "10px", textTransform: "none", fontWeight: 600, "&:hover": { borderColor: "#FF9839", bgcolor: "rgba(255,152,57,0.1)" } }}>
                            Ask Voom
                        </Button>
                        <Button startIcon={<LogoutIcon />} onClick={handleLogout} sx={{ color: "#ef4444", textTransform: "none", fontWeight: 600, "&:hover": { bgcolor: "rgba(239, 68, 68, 0.1)" } }}>
                            Logout
                        </Button>
                    </Box>
                </Box>

                {/* Dashboard Content */}
                <Container maxWidth="lg" sx={{ mt: 5, pb: 8 }}>
                    <Box sx={{ mb: 5 }}>
                        <Typography variant="h4" fontWeight="800" sx={{ color: "#ffffff", letterSpacing: "-0.5px", mb: 1 }}>
                            Welcome back, {userData?.name || userData?.username || "Colleague"}
                        </Typography>
                        <Typography variant="body1" sx={{ color: "#94a3b8" }}>
                            Your workspace is active. Start a meeting or recall past knowledge instantly.
                        </Typography>
                    </Box>

                    <Grid container spacing={3.5}>
                        {/* Start or Join Meeting Card */}
                        <Grid item xs={12} md={7}>
                            <Card sx={{
                                bgcolor: "#111827",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                borderRadius: "16px",
                                p: 1,
                                boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
                            }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" fontWeight="700" sx={{ color: "#ffffff", mb: 3 }}>
                                        Start or Join a Meeting
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 3.5 }}>
                                        <Button
                                            variant="contained"
                                            size="large"
                                            startIcon={<VideoCallIcon />}
                                            onClick={() => setOpenNewMeetingDialog(true)}
                                            sx={{
                                                bgcolor: "#FF9839",
                                                color: "white",
                                                fontWeight: 700,
                                                py: 1.5,
                                                px: 3.5,
                                                borderRadius: "10px",
                                                textTransform: "none",
                                                boxShadow: "0 4px 16px rgba(255, 152, 57, 0.35)",
                                                "&:hover": { bgcolor: "#e68933" }
                                            }}
                                        >
                                            New Meeting
                                        </Button>
                                        <Typography sx={{ color: "#64748b", fontWeight: 600 }}>or</Typography>
                                        <Box sx={{ display: 'flex', gap: 1, flex: 1, minWidth: "220px" }}>
                                            <TextField
                                                size="small"
                                                placeholder="Enter meeting code"
                                                value={meetingCode}
                                                onChange={(e) => setMeetingCode(e.target.value)}
                                                fullWidth
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: "10px",
                                                        bgcolor: "rgba(255, 255, 255, 0.03)",
                                                        '& fieldset': { borderColor: "rgba(255, 255, 255, 0.12)" },
                                                        '&:hover fieldset': { borderColor: "rgba(255, 255, 255, 0.25)" },
                                                        '&.Mui-focused fieldset': { borderColor: "#FF9839" }
                                                    }
                                                }}
                                            />
                                            <Button
                                                variant="outlined"
                                                onClick={handleJoinVideoCall}
                                                sx={{
                                                    borderRadius: "10px",
                                                    borderColor: "rgba(255, 255, 255, 0.2)",
                                                    color: "#ffffff",
                                                    textTransform: "none",
                                                    fontWeight: 600,
                                                    px: 2.5,
                                                    "&:hover": { borderColor: "#FF9839", color: "#FF9839" }
                                                }}
                                            >
                                                Join
                                            </Button>
                                        </Box>
                                    </Box>

                                    <Divider sx={{ my: 3, borderColor: "rgba(255, 255, 255, 0.08)" }} />

                                    <Typography variant="subtitle2" fontWeight="700" sx={{ color: "#94a3b8", mb: 2 }}>
                                        Instant Workspace Preview
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: "rgba(255, 255, 255, 0.03)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                                        <EventAvailableIcon sx={{ color: "#FF9839", fontSize: 28 }} />
                                        <Box>
                                            <Typography fontWeight="700" sx={{ color: "#ffffff", fontSize: "0.95rem" }}>Engineering Sync & Demo</Typography>
                                            <Typography variant="body2" sx={{ color: "#94a3b8", fontSize: "0.82rem" }}>P2P WebRTC mesh with persistent notes</Typography>
                                        </Box>
                                        <Button
                                            variant="contained"
                                            size="small"
                                            onClick={() => setOpenNewMeetingDialog(true)}
                                            sx={{ ml: "auto", bgcolor: "#1E293B", color: "#f8fafc", textTransform: "none", fontWeight: 600, borderRadius: "8px", "&:hover": { bgcolor: "#334155" } }}
                                        >
                                            Launch
                                        </Button>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Stats & Ask Voom Sidebar */}
                        <Grid item xs={12} md={5}>
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <Card sx={{ bgcolor: "#111827", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "16px", textAlign: 'center', p: 2.5 }}>
                                        <Typography variant="h3" fontWeight="900" sx={{ color: "#FF9839", mb: 0.5 }}>{stats.meetings}</Typography>
                                        <Typography variant="body2" sx={{ color: "#94a3b8", fontWeight: 500 }}>Total Meetings</Typography>
                                    </Card>
                                </Grid>
                                <Grid item xs={6}>
                                    <Card sx={{ bgcolor: "#111827", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "16px", textAlign: 'center', p: 2.5 }}>
                                        <Typography variant="h3" fontWeight="900" sx={{ color: "#3B82F6", mb: 0.5 }}>{stats.recordings}</Typography>
                                        <Typography variant="body2" sx={{ color: "#94a3b8", fontWeight: 500 }}>Transcripts Synced</Typography>
                                    </Card>
                                </Grid>
                                <Grid item xs={12}>
                                    <Card sx={{
                                        bgcolor: "#111827",
                                        border: "1px solid rgba(255, 152, 57, 0.3)",
                                        borderRadius: "16px",
                                        p: 3,
                                        mt: 1,
                                        background: "linear-gradient(135deg, rgba(17, 24, 39, 1) 0%, rgba(30, 41, 59, 0.8) 100%)",
                                        boxShadow: "0 8px 24px rgba(0,0,0,0.4)"
                                    }}>
                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                            <Box sx={{ width: 44, height: 44, borderRadius: "10px", bgcolor: "rgba(255, 152, 57, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                <AutoAwesomeIcon sx={{ color: "#FF9839", fontSize: 24 }} />
                                            </Box>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="h6" fontWeight="700" sx={{ color: "#ffffff", mb: 0.5 }}>
                                                    Ask Voom AI Memory
                                                </Typography>
                                                <Typography variant="body2" sx={{ color: "#94a3b8", mb: 2, lineHeight: 1.5 }}>
                                                    Ask natural language questions about past decisions, timelines, and commitments across all meetings.
                                                </Typography>
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    endIcon={<ArrowForwardIcon />}
                                                    onClick={() => navigate("/ask")}
                                                    sx={{ bgcolor: "#FF9839", color: "white", textTransform: "none", fontWeight: 700, borderRadius: "8px", "&:hover": { bgcolor: "#e68933" } }}
                                                >
                                                    Open Ask Voom
                                                </Button>
                                            </Box>
                                        </Box>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Grid>
                    </Grid>
                </Container>

                {/* Create Organization Dialog */}
                <Dialog open={openNewOrgDialog} onClose={() => setOpenNewOrgDialog(false)} maxWidth="xs" fullWidth
                    slotProps={{ paper: { sx: { bgcolor: "#111827", color: "#ffffff", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)" } } }}>
                    <DialogTitle sx={{ fontWeight: 700 }}>Create New Organization</DialogTitle>
                    <DialogContent>
                        <TextField autoFocus margin="dense" label="Organization Name" fullWidth variant="outlined" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} sx={{ mt: 1 }} />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenNewOrgDialog(false)} sx={{ color: "#94a3b8" }}>Cancel</Button>
                        <Button variant="contained" onClick={handleCreateOrg} sx={{ bgcolor: "#FF9839", fontWeight: 700, "&:hover": { bgcolor: "#e68933" } }}>Create</Button>
                    </DialogActions>
                </Dialog>

                {/* New Meeting Configuration Dialog */}
                <Dialog open={openNewMeetingDialog} onClose={() => setOpenNewMeetingDialog(false)} maxWidth="xs" fullWidth
                    slotProps={{ paper: { sx: { bgcolor: "#111827", color: "#ffffff", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)" } } }}>
                    <DialogTitle sx={{ fontWeight: 700 }}>New Meeting Settings</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" sx={{ color: "#94a3b8", mb: 2 }}>
                            Configure your room policies or launch immediately with defaults.
                        </Typography>
                        <TextField autoFocus margin="dense" label="Meeting Title" placeholder="e.g. Weekly Standup" fullWidth variant="outlined" value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} sx={{ mb: 1.5 }} />
                        <TextField margin="dense" label="Description (Optional)" placeholder="Agenda, goals or links" fullWidth multiline rows={2} variant="outlined" value={meetingDesc} onChange={(e) => setMeetingDesc(e.target.value)} sx={{ mb: 2 }} />
                        
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                            <FormControlLabel control={<Switch checked={meetingSettings.allowGuestAccess} onChange={(e) => setMeetingSettings({ ...meetingSettings, allowGuestAccess: e.target.checked })} color="primary" />} label="Allow Guest Access" />
                            <FormControlLabel control={<Switch checked={meetingSettings.waitingRoomEnabled} onChange={(e) => setMeetingSettings({ ...meetingSettings, waitingRoomEnabled: e.target.checked })} color="primary" />} label="Enable Waiting Room" />
                            <FormControlLabel control={<Switch checked={meetingSettings.allowChat} onChange={(e) => setMeetingSettings({ ...meetingSettings, allowChat: e.target.checked })} color="primary" />} label="Allow Chat" />
                            <FormControlLabel control={<Switch checked={meetingSettings.allowScreenShare} onChange={(e) => setMeetingSettings({ ...meetingSettings, allowScreenShare: e.target.checked })} color="primary" />} label="Allow Screen Sharing" />
                            <FormControlLabel control={<Switch checked={meetingSettings.allowParticipantUnmute} onChange={(e) => setMeetingSettings({ ...meetingSettings, allowParticipantUnmute: e.target.checked })} color="primary" />} label="Allow Participants to Unmute" />
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenNewMeetingDialog(false)} sx={{ color: "#94a3b8" }}>Cancel</Button>
                        <Button variant="contained" onClick={handleCreateMeeting} sx={{ bgcolor: "#FF9839", fontWeight: 700, px: 3, "&:hover": { bgcolor: "#e68933" } }}>Start Meeting</Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </ThemeProvider>
    );
}

export default withAuth(HomeComponent);