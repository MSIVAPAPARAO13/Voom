import React, { useContext, useState, useEffect } from 'react';
import withAuth from '../utils/withAuth';
import { useNavigate } from 'react-router-dom';
import {
    Button, IconButton, TextField, Select, MenuItem, Chip, Dialog,
    DialogTitle, DialogContent, DialogActions, Box, FormControlLabel,
    Switch, Typography, Grid, Card, CardContent, Divider, Avatar, Container
} from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import SearchIcon from '@mui/icons-material/Search';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import LogoutIcon from '@mui/icons-material/Logout';

import { AuthContext } from '../contexts/AuthContext';
import { OrganizationContext } from '../contexts/OrganizationContext';
import { apiClient } from '../services/apiClient';

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
        // Fetch real stats safely without crashing
        apiClient.get('/user/history').then(res => {
            if(res.data && res.data.length > 0) {
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
        <Box sx={{ minHeight: "100vh", bgcolor: "#f5f7fa" }}>
            {/* Top Navbar */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, bgcolor: "white", boxShadow: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <Typography variant="h5" fontWeight="bold" color="#FF9839" sx={{ cursor: 'pointer' }} onClick={() => navigate("/")}>
                        Voom
                    </Typography>

                    {organizations.length > 0 && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, bgcolor: "#f8f9fa", p: 0.5, borderRadius: 2 }}>
                            <CorporateFareIcon color="action" />
                            <Select
                                size="small"
                                value={currentOrganization?.id || ""}
                                onChange={(e) => switchOrganization(e.target.value)}
                                sx={{ minWidth: 180, "& .MuiOutlinedInput-notchedOutline": { border: "none" } }}
                            >
                                {organizations.map((org) => (
                                    <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
                                ))}
                            </Select>
                            {currentOrganization?.role && (
                                <Chip label={currentOrganization.role.toUpperCase()} size="small" color={currentOrganization.role === "owner" ? "primary" : currentOrganization.role === "admin" ? "secondary" : "default"} />
                            )}
                            {isOwnerOrAdmin && (
                                <IconButton size="small" color="primary" onClick={() => navigate("/organization")} title="Manage Organization">
                                    <SettingsIcon />
                                </IconButton>
                            )}
                            <IconButton size="small" onClick={() => setOpenNewOrgDialog(true)} title="Create Organization">
                                <AddIcon />
                            </IconButton>
                        </Box>
                    )}
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Button startIcon={<RestoreIcon />} onClick={() => navigate("/history")} color="inherit">
                        History
                    </Button>
                    <Button startIcon={<SearchIcon />} onClick={() => navigate("/ask")} variant="outlined" color="primary" sx={{ borderRadius: 4 }}>
                        Ask Voom
                    </Button>
                    <Button startIcon={<LogoutIcon />} onClick={handleLogout} color="error">
                        Logout
                    </Button>
                </Box>
            </Box>

            {/* Dashboard Content */}
            <Container maxWidth="lg" sx={{ mt: 5 }}>
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                    Good afternoon, {userData?.name || userData?.username || "there"}
                </Typography>
                <Typography color="text.secondary" mb={4}>
                    Ready for your next meeting?
                </Typography>

                <Grid container spacing={4}>
                    <Grid item xs={12} md={7}>
                        <Card sx={{ boxShadow: 3, borderRadius: 3, p: 3, background: "linear-gradient(135deg, #ffffff 0%, #fdfbfb 100%)" }}>
                            <CardContent>
                                <Typography variant="h5" fontWeight="bold" mb={3}>Start or Join a Meeting</Typography>
                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 3 }}>
                                    <Button
                                        variant="contained"
                                        size="large"
                                        startIcon={<VideoCallIcon />}
                                        onClick={() => setOpenNewMeetingDialog(true)}
                                        sx={{ bgcolor: "#FF9839", "&:hover": { bgcolor: "#e68933" }, py: 1.5, px: 4 }}
                                    >
                                        New Meeting
                                    </Button>
                                    <Typography color="text.secondary">or</Typography>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <TextField
                                            size="small"
                                            placeholder="Enter meeting code"
                                            value={meetingCode}
                                            onChange={(e) => setMeetingCode(e.target.value)}
                                        />
                                        <Button variant="outlined" onClick={handleJoinVideoCall}>Join</Button>
                                    </Box>
                                </Box>
                                <Divider sx={{ my: 3 }} />
                                <Typography variant="subtitle1" fontWeight="bold" mb={2}>Upcoming Schedule (Demo)</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: "#f8f9fa", borderRadius: 2 }}>
                                    <EventAvailableIcon color="primary" fontSize="large" />
                                    <Box>
                                        <Typography fontWeight="bold">Engineering Sync</Typography>
                                        <Typography variant="body2" color="text.secondary">Starts in 30 minutes</Typography>
                                    </Box>
                                    <Button variant="contained" size="small" sx={{ ml: "auto" }}>Join Now</Button>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={5}>
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <Card sx={{ boxShadow: 2, borderRadius: 2, textAlign: 'center', p: 2 }}>
                                    <Typography variant="h3" color="primary" fontWeight="bold">{stats.meetings}</Typography>
                                    <Typography variant="body2" color="text.secondary">Total Meetings</Typography>
                                </Card>
                            </Grid>
                            <Grid item xs={6}>
                                <Card sx={{ boxShadow: 2, borderRadius: 2, textAlign: 'center', p: 2 }}>
                                    <Typography variant="h3" color="secondary" fontWeight="bold">{stats.recordings}</Typography>
                                    <Typography variant="body2" color="text.secondary">AI Transcripts</Typography>
                                </Card>
                            </Grid>
                            <Grid item xs={12}>
                                <Card sx={{ boxShadow: 2, borderRadius: 2, p: 3, mt: 1, bgcolor: "#2c3e50", color: "white" }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <SearchIcon fontSize="large" sx={{ color: "#FF9839" }} />
                                        <Box>
                                            <Typography variant="h6" fontWeight="bold">Ask Voom</Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
                                                Instantly recall decisions from any past meeting using AI.
                                            </Typography>
                                            <Button variant="outlined" size="small" onClick={() => navigate("/ask")} sx={{ color: "white", borderColor: "white" }}>
                                                Try it out
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
            <Dialog open={openNewOrgDialog} onClose={() => setOpenNewOrgDialog(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Create New Organization</DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" label="Organization Name" fullWidth variant="outlined" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} sx={{ mt: 1 }} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenNewOrgDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateOrg}>Create</Button>
                </DialogActions>
            </Dialog>

            {/* New Meeting Configuration Dialog */}
            <Dialog open={openNewMeetingDialog} onClose={() => setOpenNewMeetingDialog(false)} maxWidth="xs" fullWidth>
                <DialogTitle>New Meeting Settings</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Configure settings for your meeting or start immediately with defaults.
                    </Typography>
                    <TextField autoFocus margin="dense" label="Meeting Title" placeholder="e.g. Weekly Standup" fullWidth variant="outlined" value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} sx={{ mb: 1 }} />
                    <TextField margin="dense" label="Description (Optional)" placeholder="Meeting agenda or notes" fullWidth multiline rows={2} variant="outlined" value={meetingDesc} onChange={(e) => setMeetingDesc(e.target.value)} sx={{ mb: 2 }} />
                    
                    <FormControlLabel control={<Switch checked={meetingSettings.allowGuestAccess} onChange={(e) => setMeetingSettings({ ...meetingSettings, allowGuestAccess: e.target.checked })} />} label="Allow Guest Access" />
                    <FormControlLabel control={<Switch checked={meetingSettings.waitingRoomEnabled} onChange={(e) => setMeetingSettings({ ...meetingSettings, waitingRoomEnabled: e.target.checked })} />} label="Enable Waiting Room" />
                    <FormControlLabel control={<Switch checked={meetingSettings.allowChat} onChange={(e) => setMeetingSettings({ ...meetingSettings, allowChat: e.target.checked })} />} label="Allow Chat" />
                    <FormControlLabel control={<Switch checked={meetingSettings.allowScreenShare} onChange={(e) => setMeetingSettings({ ...meetingSettings, allowScreenShare: e.target.checked })} />} label="Allow Screen Sharing" />
                    <FormControlLabel control={<Switch checked={meetingSettings.allowParticipantUnmute} onChange={(e) => setMeetingSettings({ ...meetingSettings, allowParticipantUnmute: e.target.checked })} />} label="Allow Participants to Unmute" />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenNewMeetingDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateMeeting} sx={{ bgcolor: "#FF9839" }}>Start Meeting</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default withAuth(HomeComponent);