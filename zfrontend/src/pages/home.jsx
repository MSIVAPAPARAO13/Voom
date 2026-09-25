import React, { useContext, useState } from 'react';
import withAuth from '../utils/withAuth';
import { useNavigate } from 'react-router-dom';
import "../App.css";
import {
    Button,
    IconButton,
    TextField,
    Select,
    MenuItem,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    FormControlLabel,
    Switch,
    Typography
} from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import SearchIcon from '@mui/icons-material/Search';

import { AuthContext } from '../contexts/AuthContext';
import { OrganizationContext } from '../contexts/OrganizationContext';
import { apiClient } from '../services/apiClient';

function HomeComponent() {
    const navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");
    const [openNewOrgDialog, setOpenNewOrgDialog] = useState(false);
    const [newOrgName, setNewOrgName] = useState("");

    // New Meeting Dialog State
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

    const { addToUserHistory, handleLogout } = useContext(AuthContext);
    const {
        organizations,
        currentOrganization,
        switchOrganization,
        createOrganization
    } = useContext(OrganizationContext);

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
            console.error("Failed to create meeting:", err);
            alert("Failed to create meeting: " + (err.response?.data?.message || err.message));
        }
    };

    const isOwnerOrAdmin = currentOrganization?.role === "owner" || currentOrganization?.role === "admin";

    return (
        <>
            <div className="navBar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                    <h2>Voom</h2>

                    {/* Organization Switcher */}
                    {organizations.length > 0 && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <CorporateFareIcon color="action" />
                            <Select
                                size="small"
                                value={currentOrganization?.id || ""}
                                onChange={(e) => switchOrganization(e.target.value)}
                                sx={{ minWidth: 160 }}
                            >
                                {organizations.map((org) => (
                                    <MenuItem key={org.id} value={org.id}>
                                        {org.name}
                                    </MenuItem>
                                ))}
                            </Select>

                            {currentOrganization?.role && (
                                <Chip
                                    label={currentOrganization.role.toUpperCase()}
                                    size="small"
                                    color={currentOrganization.role === "owner" ? "primary" : currentOrganization.role === "admin" ? "secondary" : "default"}
                                />
                            )}

                            {isOwnerOrAdmin && (
                                <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => navigate("/organization")}
                                    title="Manage Organization"
                                >
                                    <SettingsIcon />
                                </IconButton>
                            )}

                            <IconButton
                                size="small"
                                color="default"
                                onClick={() => setOpenNewOrgDialog(true)}
                                title="Create Organization"
                            >
                                <AddIcon />
                            </IconButton>
                        </Box>
                    )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <IconButton onClick={() => navigate("/history")}>
                        <RestoreIcon />
                    </IconButton>
                    <p style={{ margin: 0, cursor: "pointer", marginRight: "10px" }} onClick={() => navigate("/history")}>History</p>

                    <IconButton onClick={() => navigate("/ask")} color="primary">
                        <SearchIcon />
                    </IconButton>
                    <p style={{ margin: 0, cursor: "pointer", color: "#1976d2", fontWeight: "bold" }} onClick={() => navigate("/ask")}>Ask Voom</p>


                    <Button variant="outlined" color="error" size="small" onClick={handleLogout}>
                        Logout
                    </Button>
                </div>
            </div>

            <div className="meetContainer">
                <div className="leftPanel">
                    <div>
                        <h2>Providing Quality Video Call Just Like Quality Education</h2>

                        <div style={{ display: 'flex', gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<VideoCallIcon />}
                                onClick={() => setOpenNewMeetingDialog(true)}
                            >
                                New Meeting
                            </Button>

                            <span style={{ color: "#888" }}>or</span>

                            <TextField
                                onChange={e => setMeetingCode(e.target.value)}
                                id="outlined-basic"
                                label="Meeting Code"
                                variant="outlined"
                                size="small"
                                value={meetingCode}
                            />
                            <Button onClick={handleJoinVideoCall} variant='outlined'>Join</Button>
                        </div>
                    </div>
                </div>
                <div className='rightPanel'>
                    <img srcSet='/logo3.png' alt="" />
                </div>
            </div>

            {/* Create Organization Dialog */}
            <Dialog open={openNewOrgDialog} onClose={() => setOpenNewOrgDialog(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Create New Organization</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Organization Name"
                        fullWidth
                        variant="outlined"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenNewOrgDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateOrg}>Create</Button>
                </DialogActions>
            </Dialog>

            {/* New Meeting Configuration Dialog */}
            <Dialog open={openNewMeetingDialog} onClose={() => setOpenNewMeetingDialog(false)} maxWidth="xs" fullWidth>
                <DialogTitle>New Meeting</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Configure settings for your meeting or start immediately with defaults.
                    </Typography>

                    <TextField
                        autoFocus
                        margin="dense"
                        label="Meeting Title"
                        placeholder="e.g. Weekly Standup"
                        fullWidth
                        variant="outlined"
                        value={meetingTitle}
                        onChange={(e) => setMeetingTitle(e.target.value)}
                        sx={{ mb: 1 }}
                    />

                    <TextField
                        margin="dense"
                        label="Description (Optional)"
                        placeholder="Meeting agenda or notes"
                        fullWidth
                        multiline
                        rows={2}
                        variant="outlined"
                        value={meetingDesc}
                        onChange={(e) => setMeetingDesc(e.target.value)}
                        sx={{ mb: 2 }}
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={meetingSettings.allowGuestAccess}
                                onChange={(e) => setMeetingSettings({ ...meetingSettings, allowGuestAccess: e.target.checked })}
                            />
                        }
                        label="Allow Guest Access"
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={meetingSettings.waitingRoomEnabled}
                                onChange={(e) => setMeetingSettings({ ...meetingSettings, waitingRoomEnabled: e.target.checked })}
                            />
                        }
                        label="Enable Waiting Room"
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={meetingSettings.allowChat}
                                onChange={(e) => setMeetingSettings({ ...meetingSettings, allowChat: e.target.checked })}
                            />
                        }
                        label="Allow Chat"
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={meetingSettings.allowScreenShare}
                                onChange={(e) => setMeetingSettings({ ...meetingSettings, allowScreenShare: e.target.checked })}
                            />
                        }
                        label="Allow Screen Sharing"
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={meetingSettings.allowParticipantUnmute}
                                onChange={(e) => setMeetingSettings({ ...meetingSettings, allowParticipantUnmute: e.target.checked })}
                            />
                        }
                        label="Allow Participants to Unmute"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenNewMeetingDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateMeeting}>Start Meeting</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

export default withAuth(HomeComponent);