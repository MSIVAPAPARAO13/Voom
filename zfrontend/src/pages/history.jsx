import React, { useContext, useEffect, useState, useRef } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    Card,
    CardContent,
    CardActions,
    Typography,
    IconButton,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Tabs,
    Tab,
    List,
    ListItem,
    ListItemText,
    Chip,
    CircularProgress,
    TextField,
    InputAdornment
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import VideocamIcon from '@mui/icons-material/Videocam';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import SearchIcon from '@mui/icons-material/Search';
import withAuth from '../utils/withAuth';
import { apiClient } from '../services/apiClient';
import server from '../environment';

function History() {
    const { getHistoryOfUser } = useContext(AuthContext);
    const [meetings, setMeetings] = useState([]);
    const [selectedMeetingCode, setSelectedMeetingCode] = useState(null);
    const [workspaceData, setWorkspaceData] = useState(null);
    const [loadingWorkspace, setLoadingWorkspace] = useState(false);
    const [workspaceTab, setWorkspaceTab] = useState(0);

    // Phase 6: Chat History States
    const [selectedChatMeetingCode, setSelectedChatMeetingCode] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [loadingChat, setLoadingChat] = useState(false);

    // Phase 7: Recording History States
    const [selectedRecordingsMeetingCode, setSelectedRecordingsMeetingCode] = useState(null);
    const [recordingsList, setRecordingsList] = useState([]);
    const [loadingRecordings, setLoadingRecordings] = useState(false);
    const [playingRecordingId, setPlayingRecordingId] = useState(null);

    // Phase 8: Transcript States & Player Navigation
    const [selectedTranscriptRecordingId, setSelectedTranscriptRecordingId] = useState(null);
    const [transcriptData, setTranscriptData] = useState(null);
    const [loadingTranscript, setLoadingTranscript] = useState(false);
    const [startingTranscription, setStartingTranscription] = useState(false);
    const [transcriptSearchQuery, setTranscriptSearchQuery] = useState("");
    const [transcriptSearchResults, setTranscriptSearchResults] = useState(null);
    const [aiIntelligenceData, setAiIntelligenceData] = useState(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [startingAI, setStartingAI] = useState(false);
    const aiPollingIntervalRef = useRef(null);
    const videoRef = useRef(null);
    const pollingIntervalRef = useRef(null);

    const formatTimestamp = (sec) => {
        if (typeof sec !== "number" || isNaN(sec)) return "00:00";
        const minutes = Math.floor(sec / 60);
        const seconds = Math.floor(sec % 60);
        return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    };

    const startPollingTranscript = (meetingCode, recordingId) => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = setInterval(async () => {
            try {
                const res = await apiClient.get(`/meetings/${meetingCode}/recordings/${recordingId}/transcription`);
                if (res.data.status === "completed") {
                    clearInterval(pollingIntervalRef.current);
                    const fullRes = await apiClient.get(`/meetings/${meetingCode}/recordings/${recordingId}/transcript`);
                    setTranscriptData({ ...res.data, ...fullRes.data });
                } else if (res.data.status === "failed") {
                    clearInterval(pollingIntervalRef.current);
                    setTranscriptData(res.data);
                } else {
                    setTranscriptData(res.data);
                }
            } catch (e) {
                clearInterval(pollingIntervalRef.current);
            }
        }, 3000);
    };

    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (aiPollingIntervalRef.current) clearInterval(aiPollingIntervalRef.current);
        };
    }, []);

    const fetchTranscriptStatusAndData = async (meetingCode, recordingId) => {
        setLoadingTranscript(true);
        try {
            const statusRes = await apiClient.get(`/meetings/${meetingCode}/recordings/${recordingId}/transcription`);
            const statusData = statusRes.data;

            if (statusData.status === "completed") {
                const transcriptRes = await apiClient.get(`/meetings/${meetingCode}/recordings/${recordingId}/transcript`);
                setTranscriptData({
                    ...statusData,
                    ...transcriptRes.data
                });
                if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            } else {
                setTranscriptData(statusData);
                if (statusData.status === "queued" || statusData.status === "processing") {
                    startPollingTranscript(meetingCode, recordingId);
                }
            }
        } catch (err) {
            if (err.response?.status === 404) {
                setTranscriptData({ status: "not_started" });
            } else {
                console.error("Failed to fetch transcript status:", err);
                setTranscriptData({ status: "error", error: err.response?.data?.message || err.message });
            }
        } finally {
            setLoadingTranscript(false);
        }
    };

    const handleOpenTranscript = async (meetingCode, recordingId) => {
        if (selectedTranscriptRecordingId === recordingId) {
            setSelectedTranscriptRecordingId(null);
            setTranscriptData(null);
            setTranscriptSearchQuery("");
            setTranscriptSearchResults(null);
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            return;
        }

        setSelectedTranscriptRecordingId(recordingId);
        setTranscriptSearchQuery("");
        setTranscriptSearchResults(null);
        setPlayingRecordingId(recordingId);
        await fetchTranscriptStatusAndData(meetingCode, recordingId);
        await fetchAIIntelligence(meetingCode, recordingId);
    };

    const startPollingAI = (meetingCode, recordingId) => {
        if (aiPollingIntervalRef.current) clearInterval(aiPollingIntervalRef.current);
        aiPollingIntervalRef.current = setInterval(async () => {
            try {
                const res = await apiClient.get(`/meetings/${meetingCode}/recordings/${recordingId}/intelligence`);
                setAiIntelligenceData(res.data);
                if (res.data.status === "completed" || res.data.status === "failed") {
                    clearInterval(aiPollingIntervalRef.current);
                }
            } catch (e) {
                clearInterval(aiPollingIntervalRef.current);
            }
        }, 3000);
    };

    const fetchAIIntelligence = async (meetingCode, recordingId) => {
        setLoadingAI(true);
        try {
            const res = await apiClient.get(`/meetings/${meetingCode}/recordings/${recordingId}/intelligence`);
            setAiIntelligenceData(res.data);
            if (res.data.status === "queued" || res.data.status === "processing") {
                startPollingAI(meetingCode, recordingId);
            }
        } catch (err) {
            if (err.response?.status === 404) {
                setAiIntelligenceData({ status: "not_started" });
            } else {
                setAiIntelligenceData({ status: "error", error: err.response?.data?.message || err.message });
            }
        } finally {
            setLoadingAI(false);
        }
    };

    const handleStartAI = async (meetingCode, recordingId) => {
        setStartingAI(true);
        try {
            const res = await apiClient.post(`/meetings/${meetingCode}/recordings/${recordingId}/intelligence`);
            setAiIntelligenceData(res.data.intelligence || { status: "processing" });
            startPollingAI(meetingCode, recordingId);
        } catch (err) {
            alert(err.response?.data?.message || "Failed to start AI analysis");
        } finally {
            setStartingAI(false);
        }
    };

    const handleStartTranscription = async (meetingCode, recordingId) => {
        setStartingTranscription(true);
        try {
            const res = await apiClient.post(`/meetings/${meetingCode}/recordings/${recordingId}/transcription`);
            setTranscriptData(res.data.transcript || { status: "processing" });
            startPollingTranscript(meetingCode, recordingId);
        } catch (err) {
            alert(err.response?.data?.message || "Failed to start transcription");
        } finally {
            setStartingTranscription(false);
        }
    };

    const handleSearchTranscript = async (meetingCode, recordingId, query) => {
        setTranscriptSearchQuery(query);
        if (!query.trim()) {
            setTranscriptSearchResults(null);
            return;
        }
        try {
            const res = await apiClient.get(`/meetings/${meetingCode}/recordings/${recordingId}/transcript/search?q=${encodeURIComponent(query)}`);
            setTranscriptSearchResults(res.data || []);
        } catch (err) {
            console.error("Failed to search transcript:", err);
        }
    };

    const handleSeekVideo = (startTime) => {
        if (videoRef.current) {
            videoRef.current.currentTime = startTime;
            videoRef.current.play();
        }
    };

    const handleCloseRecordings = () => {
        setSelectedRecordingsMeetingCode(null);
        setRecordingsList([]);
        setPlayingRecordingId(null);
        setSelectedTranscriptRecordingId(null);
        setTranscriptData(null);
        setTranscriptSearchQuery("");
        setTranscriptSearchResults(null);
        setAiIntelligenceData(null);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        if (aiPollingIntervalRef.current) clearInterval(aiPollingIntervalRef.current);
    };

    const routeTo = useNavigate();

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const history = await getHistoryOfUser();
                setMeetings(history || []);
            } catch (err) {
                console.error("Failed to fetch history:", err);
            }
        };
        fetchHistory();
    }, [getHistoryOfUser]);

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleOpenWorkspace = async (meetingCode) => {
        setSelectedMeetingCode(meetingCode);
        setLoadingWorkspace(true);
        setWorkspaceData(null);
        try {
            const res = await apiClient.get(`/meetings/${meetingCode}/workspace`);
            setWorkspaceData(res.data.workspace);
        } catch (err) {
            console.error("Failed to fetch workspace:", err);
            setWorkspaceData({
                notes: { content: "Could not load notes." },
                agenda: [],
                tasks: [],
                resources: []
            });
        } finally {
            setLoadingWorkspace(false);
        }
    };

    const handleCloseWorkspace = () => {
        setSelectedMeetingCode(null);
        setWorkspaceData(null);
    };

    const handleOpenChat = async (meetingCode) => {
        setSelectedChatMeetingCode(meetingCode);
        setLoadingChat(true);
        setChatMessages([]);
        try {
            const res = await apiClient.get(`/meetings/${meetingCode}/messages`);
            setChatMessages(res.data.messages || []);
        } catch (err) {
            console.error("Failed to fetch chat messages:", err);
        } finally {
            setLoadingChat(false);
        }
    };

    const handleCloseChat = () => {
        setSelectedChatMeetingCode(null);
        setChatMessages([]);
    };

    // Phase 7: Recording Action Handlers
    const handleOpenRecordings = async (meetingCode) => {
        setSelectedRecordingsMeetingCode(meetingCode);
        setLoadingRecordings(true);
        setRecordingsList([]);
        setPlayingRecordingId(null);
        try {
            const res = await apiClient.get(`/meetings/${meetingCode}/recordings`);
            setRecordingsList(res.data.recordings || []);
        } catch (err) {
            console.error("Failed to fetch recordings:", err);
        } finally {
            setLoadingRecordings(false);
        }
    };


    const handleDeleteRecording = async (meetingCode, recordingId) => {
        if (!window.confirm("Are you sure you want to delete this recording? This action cannot be undone.")) return;
        try {
            await apiClient.delete(`/meetings/${meetingCode}/recordings/${recordingId}`);
            setRecordingsList(prev => prev.filter(r => r._id !== recordingId));
            if (playingRecordingId === recordingId) setPlayingRecordingId(null);
        } catch (err) {
            alert(err.response?.data?.message || "Failed to delete recording");
        }
    };

    const formatDuration = (seconds) => {
        if (!seconds) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "#f5f7fa", pt: 4, pb: 8 }}>
            <Box sx={{ maxWidth: "1000px", mx: "auto", px: 3 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4, bgcolor: "white", p: 3, borderRadius: 2, boxShadow: 1 }}>
                    <Box>
                        <Typography variant="h4" sx={{ fontWeight: 800, color: "#2c3e50" }}>
                            Meeting History
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary">
                            Everything your team has discussed, captured and learned.
                        </Typography>
                    </Box>
                    <Button variant="outlined" startIcon={<HomeIcon />} onClick={() => routeTo("/home")} sx={{ borderColor: "#FF9839", color: "#FF9839", "&:hover": { borderColor: "#e68933", bgcolor: "rgba(255,152,57,0.1)" } }}>
                        Back to Dashboard
                    </Button>
                </Box>

                {meetings.length !== 0 ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {meetings.map((e, i) => (
                            <Card key={e._id || i} sx={{ borderRadius: 3, boxShadow: 2, overflow: 'visible', borderLeft: e.status === "live" ? "6px solid #2ecc71" : "6px solid #FF9839" }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                                        <Box>
                                            <Typography variant="h5" sx={{ fontWeight: 700, color: "#2c3e50", mb: 0.5 }}>
                                                {e.title && e.title !== "Untitled Meeting" ? e.title : `Meeting: ${e.meetingCode}`}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <span>{formatDate(e.date || e.startedAt)}</span>
                                                <span>•</span>
                                                <span>Code: <strong>{e.meetingCode}</strong></span>
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label={e.status ? e.status.toUpperCase() : "ENDED"}
                                            size="small"
                                            color={e.status === "live" ? "success" : "default"}
                                            sx={{ fontWeight: "bold" }}
                                        />
                                    </Box>
                                    
                                    {e.description && (
                                        <Typography sx={{ color: "text.secondary", mb: 2, bgcolor: "#f8f9fa", p: 1.5, borderRadius: 1 }}>
                                            {e.description}
                                        </Typography>
                                    )}
                                </CardContent>
                                <Box sx={{ bgcolor: "#f8f9fa", px: 3, py: 2, borderTop: "1px solid #eee", display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        startIcon={<AssignmentIcon />}
                                        onClick={() => handleOpenWorkspace(e.meetingCode)}
                                        sx={{ bgcolor: "#FF9839", "&:hover": { bgcolor: "#e68933" }, boxShadow: 0 }}
                                    >
                                        Workspace
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<ChatIcon />}
                                        onClick={() => handleOpenChat(e.meetingCode)}
                                        sx={{ borderColor: "#bdc3c7", color: "#34495e" }}
                                    >
                                        Chat Log
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<VideocamIcon />}
                                        onClick={() => handleOpenRecordings(e.meetingCode)}
                                        sx={{ borderColor: "#bdc3c7", color: "#34495e" }}
                                    >
                                        Recordings & Transcripts
                                    </Button>
                                </Box>
                            </Card>
                        ))}
                    </Box>
                ) : (
                    <Box sx={{ textAlign: "center", py: 10, bgcolor: "white", borderRadius: 3, boxShadow: 1 }}>
                        <Typography variant="h6" color="text.secondary" mb={2}>No past meetings found.</Typography>
                        <Button variant="contained" onClick={() => routeTo("/home")} sx={{ bgcolor: "#FF9839" }}>
                            Start your first meeting
                        </Button>
                    </Box>
                )}
            </Box>

            {/* Persistent Workspace Viewer Dialog */}
            <Dialog
                open={Boolean(selectedMeetingCode)}
                onClose={handleCloseWorkspace}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Meeting Workspace: {selectedMeetingCode}</span>
                    <IconButton size="small" onClick={handleCloseWorkspace}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent dividers>
                    {loadingWorkspace ? (
                        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : workspaceData ? (
                        <Box>
                            <Tabs
                                value={workspaceTab}
                                onChange={(e, v) => setWorkspaceTab(v)}
                                sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
                            >
                                <Tab label="Notes" />
                                <Tab label={`Agenda (${workspaceData.agenda?.length || 0})`} />
                                <Tab label={`Tasks (${workspaceData.tasks?.length || 0})`} />
                                <Tab label={`Resources (${workspaceData.resources?.length || 0})`} />
                            </Tabs>

                            {/* Tab 0: Notes */}
                            {workspaceTab === 0 && (
                                <Box sx={{ p: 1 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        Last updated: {workspaceData.notes?.updatedAt ? formatDate(workspaceData.notes.updatedAt) : "Never"}
                                        {workspaceData.notes?.updatedBy?.name ? ` by ${workspaceData.notes.updatedBy.name}` : ""}
                                        {" "}(Version {workspaceData.notes?.version || 1})
                                    </Typography>
                                    <Box
                                        sx={{
                                            p: 2,
                                            background: "#f9f9f9",
                                            borderRadius: 1,
                                            minHeight: "150px",
                                            whiteSpace: "pre-wrap",
                                            fontFamily: "inherit"
                                        }}
                                    >
                                        {workspaceData.notes?.content || "No notes recorded for this meeting."}
                                    </Box>
                                </Box>
                            )}

                            {/* Tab 1: Agenda */}
                            {workspaceTab === 1 && (
                                <List dense>
                                    {workspaceData.agenda?.length > 0 ? (
                                        workspaceData.agenda.map((item, idx) => (
                                            <ListItem key={item._id || idx} divider>
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                            <strong>{item.order || idx + 1}.</strong> {item.title}
                                                            <Chip
                                                                label={item.status?.toUpperCase() || "PENDING"}
                                                                size="small"
                                                                color={item.status === "completed" ? "success" : item.status === "active" ? "primary" : "default"}
                                                            />
                                                            {item.duration > 0 && (
                                                                <Typography variant="caption" color="text.secondary">
                                                                    ({item.duration} min)
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    }
                                                    secondary={item.description || null}
                                                />
                                            </ListItem>
                                        ))
                                    ) : (
                                        <Typography color="text.secondary" sx={{ p: 2 }}>No agenda items.</Typography>
                                    )}
                                </List>
                            )}

                            {/* Tab 2: Tasks */}
                            {workspaceTab === 2 && (
                                <List dense>
                                    {workspaceData.tasks?.length > 0 ? (
                                        workspaceData.tasks.map((task, idx) => (
                                            <ListItem key={task._id || idx} divider>
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                            <span>{task.title}</span>
                                                            <Chip
                                                                label={task.status?.replace("_", " ").toUpperCase() || "TODO"}
                                                                size="small"
                                                                color={task.status === "completed" ? "success" : task.status === "in_progress" ? "warning" : "default"}
                                                            />
                                                        </Box>
                                                    }
                                                    secondary={
                                                        <span>
                                                            {task.description && `${task.description} • `}
                                                            Assigned to: <strong>{task.assignedTo?.name || task.assignedTo?.username || "Unassigned"}</strong>
                                                            {task.dueDate && ` • Due: ${new Date(task.dueDate).toLocaleDateString()}`}
                                                        </span>
                                                    }
                                                />
                                            </ListItem>
                                        ))
                                    ) : (
                                        <Typography color="text.secondary" sx={{ p: 2 }}>No action items.</Typography>
                                    )}
                                </List>
                            )}

                            {/* Tab 3: Resources */}
                            {workspaceTab === 3 && (
                                <List dense>
                                    {workspaceData.resources?.length > 0 ? (
                                        workspaceData.resources.map((resItem, idx) => (
                                            <ListItem key={resItem._id || idx} divider>
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                            <a href={resItem.url} target="_blank" rel="noopener noreferrer" style={{ color: "#1976d2", fontWeight: 600, textDecoration: "none" }}>
                                                                {resItem.title}
                                                            </a>
                                                            <Chip label={resItem.type?.toUpperCase() || "LINK"} size="small" variant="outlined" />
                                                        </Box>
                                                    }
                                                    secondary={
                                                        <span>
                                                            {resItem.description && `${resItem.description} • `}
                                                            URL: {resItem.url}
                                                        </span>
                                                    }
                                                />
                                            </ListItem>
                                        ))
                                    ) : (
                                        <Typography color="text.secondary" sx={{ p: 2 }}>No reference resources.</Typography>
                                    )}
                                </List>
                            )}
                        </Box>
                    ) : (
                        <Typography color="text.secondary">Workspace data unavailable.</Typography>
                    )}
                </DialogContent>

                <DialogActions>
                    <Button onClick={handleCloseWorkspace}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Persistent Chat History Dialog */}
            <Dialog
                open={Boolean(selectedChatMeetingCode)}
                onClose={handleCloseChat}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Meeting Chat: {selectedChatMeetingCode}</span>
                    <IconButton size="small" onClick={handleCloseChat}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {loadingChat ? (
                        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : chatMessages.length > 0 ? (
                        <List dense>
                            {chatMessages.map((msg, idx) => (
                                <ListItem key={msg._id || idx} divider sx={{ flexDirection: "column", alignItems: "flex-start", py: 1.5 }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", mb: 0.5 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                            {msg.senderName || "Participant"}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {formatDate(msg.createdAt)}
                                        </Typography>
                                    </Box>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontStyle: msg.isDeleted ? "italic" : "normal",
                                            color: msg.isDeleted ? "text.secondary" : "text.primary"
                                        }}
                                    >
                                        {msg.message} {msg.isEdited && !msg.isDeleted && <span style={{ fontSize: "11px", color: "#888" }}>(edited)</span>}
                                    </Typography>
                                    {msg.reactions && msg.reactions.length > 0 && (
                                        <Box sx={{ display: "flex", gap: 0.5, mt: 1, flexWrap: "wrap" }}>
                                            {msg.reactions.map((r, rIdx) => (
                                                <Chip key={rIdx} label={`${r.emoji} ${r.username}`} size="small" variant="outlined" />
                                            ))}
                                        </Box>
                                    )}
                                </ListItem>
                            ))}
                        </List>
                    ) : (
                        <Typography color="text.secondary" sx={{ p: 2 }}>No chat messages in this meeting.</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseChat}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Phase 7: Meeting Recordings Dialog */}
            <Dialog
                open={Boolean(selectedRecordingsMeetingCode)}
                onClose={handleCloseRecordings}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Recordings: {selectedRecordingsMeetingCode}</span>
                    <IconButton size="small" onClick={handleCloseRecordings}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {loadingRecordings ? (
                        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : recordingsList.length > 0 ? (
                        <List dense>
                            {recordingsList.map((rec) => {
                                const token = localStorage.getItem("token") || "";
                                const mediaUrl = `${server}/api/v1/meetings/${selectedRecordingsMeetingCode}/recordings/${rec._id}/media?token=${encodeURIComponent(token)}`;
                                const isPlaying = playingRecordingId === rec._id;

                                return (
                                    <ListItem
                                        key={rec._id}
                                        divider
                                        sx={{ flexDirection: "column", alignItems: "flex-start", py: 2 }}
                                    >
                                        <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", mb: 1 }}>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                                    {formatDate(rec.startedAt)}
                                                </Typography>
                                                <Chip
                                                    label={rec.status?.toUpperCase() || "READY"}
                                                    size="small"
                                                    color={rec.status === "ready" ? "success" : rec.status === "recording" ? "warning" : "default"}
                                                />
                                            </Box>
                                            <Typography variant="caption" color="text.secondary">
                                                Duration: <strong>{formatDuration(rec.duration)}</strong> • Size: <strong>{rec.fileSize ? `${(rec.fileSize / (1024 * 1024)).toFixed(2)} MB` : "N/A"}</strong>
                                            </Typography>
                                        </Box>

                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                            Started by: <strong>{rec.startedByName || "Host"}</strong>
                                        </Typography>

                                        {isPlaying && (
                                            <Box sx={{ width: "100%", mb: 1.5, borderRadius: 1, overflow: "hidden", backgroundColor: "#000" }}>
                                                <video
                                                    ref={videoRef}
                                                    controls
                                                    autoPlay
                                                    style={{ width: "100%", maxHeight: 360, display: "block" }}
                                                    src={mediaUrl}
                                                >
                                                    Your browser does not support the video tag.
                                                </video>
                                            </Box>
                                        )}

                                        {selectedTranscriptRecordingId === rec._id && (
                                            <Box sx={{ width: "100%", mb: 2, p: 2, bgcolor: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: 2 }}>
                                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                            Transcript
                                                        </Typography>
                                                        <Chip
                                                            size="small"
                                                            label={
                                                                transcriptData?.status === "completed"
                                                                    ? "READY"
                                                                    : transcriptData?.status === "processing"
                                                                    ? "PROCESSING"
                                                                    : transcriptData?.status === "queued"
                                                                    ? "QUEUED"
                                                                    : transcriptData?.status === "failed"
                                                                    ? "FAILED"
                                                                    : "NOT TRANSCRIBED"
                                                            }
                                                            color={
                                                                transcriptData?.status === "completed"
                                                                    ? "success"
                                                                    : transcriptData?.status === "processing" || transcriptData?.status === "queued"
                                                                    ? "warning"
                                                                    : transcriptData?.status === "failed"
                                                                    ? "error"
                                                                    : "default"
                                                            }
                                                        />
                                                        {transcriptData?.provider && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                Provider: <strong>{transcriptData.provider.toUpperCase()}</strong>
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                    <Box sx={{ display: "flex", gap: 1 }}>
                                                        {(!transcriptData || transcriptData.status === "not_started" || transcriptData.status === "failed") && (
                                                            <Button
                                                                size="small"
                                                                variant="contained"
                                                                disabled={startingTranscription}
                                                                onClick={() => handleStartTranscription(selectedRecordingsMeetingCode, rec._id)}
                                                            >
                                                                {startingTranscription ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                                                                {transcriptData?.status === "failed" ? "Retry Transcription" : "Start Transcription"}
                                                            </Button>
                                                        )}
                                                        {(transcriptData?.status === "queued" || transcriptData?.status === "processing") && (
                                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                                <CircularProgress size={18} />
                                                                <Typography variant="caption" color="text.secondary">
                                                                    Processing transcription...
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                </Box>

                                                {loadingTranscript ? (
                                                    <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                                                        <CircularProgress size={24} />
                                                    </Box>
                                                ) : transcriptData?.status === "completed" ? (
                                                    <Box>
                                                        <TextField
                                                            size="small"
                                                            fullWidth
                                                            placeholder="Search transcript by keyword..."
                                                            value={transcriptSearchQuery}
                                                            onChange={(e) => handleSearchTranscript(selectedRecordingsMeetingCode, rec._id, e.target.value)}
                                                            InputProps={{
                                                                startAdornment: (
                                                                    <InputAdornment position="start">
                                                                        <SearchIcon fontSize="small" />
                                                                    </InputAdornment>
                                                                ),
                                                                endAdornment: transcriptSearchQuery ? (
                                                                    <InputAdornment position="end">
                                                                        <IconButton size="small" onClick={() => handleSearchTranscript(selectedRecordingsMeetingCode, rec._id, "")}>
                                                                            <CloseIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </InputAdornment>
                                                                ) : null
                                                            }}
                                                            sx={{ mb: 1.5, bgcolor: "#fff" }}
                                                        />

                                                        {transcriptSearchQuery && (
                                                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                                                                Found {(transcriptSearchResults || []).length} matching segment(s)
                                                            </Typography>
                                                        )}

                                                        <Box sx={{ maxHeight: 280, overflowY: "auto", border: "1px solid #e0e0e0", borderRadius: 1, p: 1, bgcolor: "#fff" }}>
                                                            {(transcriptSearchResults !== null ? transcriptSearchResults : (transcriptData.segments || [])).length > 0 ? (
                                                                (transcriptSearchResults !== null ? transcriptSearchResults : (transcriptData.segments || [])).map((seg, sIdx) => (
                                                                    <Box
                                                                        key={sIdx}
                                                                        onClick={() => handleSeekVideo(seg.start)}
                                                                        sx={{
                                                                            display: "flex",
                                                                            gap: 1.5,
                                                                            py: 0.75,
                                                                            px: 1,
                                                                            borderRadius: 1,
                                                                            cursor: "pointer",
                                                                            "&:hover": { bgcolor: "#e3f2fd" }
                                                                        }}
                                                                    >
                                                                        <Typography
                                                                            variant="caption"
                                                                            sx={{
                                                                                fontFamily: "monospace",
                                                                                fontWeight: 700,
                                                                                color: "primary.main",
                                                                                minWidth: 52,
                                                                                pt: 0.2
                                                                            }}
                                                                        >
                                                                            [{formatTimestamp(seg.start)}]
                                                                        </Typography>
                                                                        <Typography variant="body2" sx={{ flex: 1, color: "#212121" }}>
                                                                            {seg.speaker && <strong>{seg.speaker}: </strong>}
                                                                            {seg.text}
                                                                        </Typography>
                                                                    </Box>
                                                                ))
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                                                                    {transcriptSearchQuery ? "No matching segments found." : "No transcript segments available."}
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    </Box>
                                                ) : transcriptData?.status === "failed" ? (
                                                    <Typography variant="body2" color="error" sx={{ p: 1 }}>
                                                        Transcription failed: {transcriptData.error || "An unexpected error occurred"}. Please click retry.
                                                    </Typography>
                                                ) : (
                                                    <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                                                        This recording has not been transcribed yet. Click "Start Transcription" to generate timestamped text.
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}

                                        {selectedTranscriptRecordingId === rec._id && (
                                            <Box sx={{ width: "100%", mb: 2, p: 2, bgcolor: "#f3e5f5", border: "1px solid #ce93d8", borderRadius: 2 }}>
                                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#6a1b9a" }}>
                                                            AI Insights
                                                        </Typography>
                                                        <Chip
                                                            size="small"
                                                            label={
                                                                aiIntelligenceData?.status === "completed"
                                                                    ? "READY"
                                                                    : aiIntelligenceData?.status === "processing"
                                                                    ? "PROCESSING"
                                                                    : aiIntelligenceData?.status === "queued"
                                                                    ? "QUEUED"
                                                                    : aiIntelligenceData?.status === "failed"
                                                                    ? "FAILED"
                                                                    : "NOT GENERATED"
                                                            }
                                                            color={
                                                                aiIntelligenceData?.status === "completed"
                                                                    ? "secondary"
                                                                    : aiIntelligenceData?.status === "processing" || aiIntelligenceData?.status === "queued"
                                                                    ? "warning"
                                                                    : aiIntelligenceData?.status === "failed"
                                                                    ? "error"
                                                                    : "default"
                                                            }
                                                        />
                                                    </Box>
                                                    <Box sx={{ display: "flex", gap: 1 }}>
                                                        {(!aiIntelligenceData || aiIntelligenceData.status === "not_started" || aiIntelligenceData.status === "failed") && (
                                                            <Button
                                                                size="small"
                                                                variant="contained"
                                                                color="secondary"
                                                                disabled={startingAI || transcriptData?.status !== "completed"}
                                                                onClick={() => handleStartAI(selectedRecordingsMeetingCode, rec._id)}
                                                            >
                                                                {startingAI ? <CircularProgress size={16} sx={{ mr: 1, color: "inherit" }} /> : null}
                                                                {aiIntelligenceData?.status === "failed" ? "Retry AI Insights" : "Generate AI Insights"}
                                                            </Button>
                                                        )}
                                                        {(aiIntelligenceData?.status === "queued" || aiIntelligenceData?.status === "processing") && (
                                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                                <CircularProgress size={18} color="secondary" />
                                                                <Typography variant="caption" color="text.secondary">
                                                                    Generating intelligence...
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                </Box>

                                                {loadingAI ? (
                                                    <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                                                        <CircularProgress size={24} color="secondary" />
                                                    </Box>
                                                ) : aiIntelligenceData?.status === "completed" ? (
                                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                                        <Box>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#4a148c" }}>Summary</Typography>
                                                            <Typography variant="body2" sx={{ color: "#333" }}>{aiIntelligenceData.summary}</Typography>
                                                        </Box>
                                                        
                                                        {aiIntelligenceData.keyPoints?.length > 0 && (
                                                            <Box>
                                                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#4a148c" }}>Key Points</Typography>
                                                                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                                                                    {aiIntelligenceData.keyPoints.map((pt, idx) => (
                                                                        <li key={idx}><Typography variant="body2" sx={{ color: "#333" }}>{pt}</Typography></li>
                                                                    ))}
                                                                </ul>
                                                            </Box>
                                                        )}

                                                        {aiIntelligenceData.decisions?.length > 0 && (
                                                            <Box>
                                                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#4a148c", mb: 0.5 }}>Decisions</Typography>
                                                                <List dense disablePadding>
                                                                    {aiIntelligenceData.decisions.map((dec, idx) => (
                                                                        <ListItem key={idx} disableGutters sx={{ py: 0.5 }}>
                                                                            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                                                                                {dec.timestamp !== null && (
                                                                                    <Chip 
                                                                                        size="small" 
                                                                                        label={formatTimestamp(dec.timestamp)} 
                                                                                        onClick={() => handleSeekVideo(dec.timestamp)}
                                                                                        sx={{ cursor: "pointer", fontFamily: "monospace", bgcolor: "#f3e5f5", color: "#6a1b9a", "&:hover": { bgcolor: "#e1bee7" } }}
                                                                                    />
                                                                                )}
                                                                                <Typography variant="body2" sx={{ pt: dec.timestamp !== null ? 0.3 : 0 }}>{dec.text}</Typography>
                                                                            </Box>
                                                                        </ListItem>
                                                                    ))}
                                                                </List>
                                                            </Box>
                                                        )}

                                                        {aiIntelligenceData.actionItems?.length > 0 && (
                                                            <Box>
                                                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#4a148c", mb: 0.5 }}>Action Items</Typography>
                                                                <List dense disablePadding>
                                                                    {aiIntelligenceData.actionItems.map((item, idx) => (
                                                                        <ListItem key={idx} disableGutters sx={{ py: 0.5, alignItems: "flex-start" }}>
                                                                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, borderLeft: "2px solid #ce93d8", pl: 1.5 }}>
                                                                                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                                                                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.task}</Typography>
                                                                                    {item.timestamp !== null && (
                                                                                        <Chip 
                                                                                            size="small" 
                                                                                            label={formatTimestamp(item.timestamp)} 
                                                                                            onClick={() => handleSeekVideo(item.timestamp)}
                                                                                            sx={{ height: 20, cursor: "pointer", fontFamily: "monospace", fontSize: "0.65rem", bgcolor: "#f3e5f5", color: "#6a1b9a", "&:hover": { bgcolor: "#e1bee7" } }}
                                                                                        />
                                                                                    )}
                                                                                </Box>
                                                                                <Typography variant="caption" color="text.secondary">
                                                                                    Owner: {item.assignee || "Unknown"} • Due: {item.dueDate || "Not specified"}
                                                                                </Typography>
                                                                            </Box>
                                                                        </ListItem>
                                                                    ))}
                                                                </List>
                                                            </Box>
                                                        )}

                                                        {aiIntelligenceData.topics?.length > 0 && (
                                                            <Box>
                                                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#4a148c", mb: 1 }}>Topics</Typography>
                                                                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                                                                    {aiIntelligenceData.topics.map((t, idx) => (
                                                                        <Chip key={idx} label={t} size="small" variant="outlined" color="secondary" />
                                                                    ))}
                                                                </Box>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                ) : aiIntelligenceData?.status === "failed" ? (
                                                    <Typography variant="body2" color="error" sx={{ p: 1 }}>
                                                        AI Generation failed: {aiIntelligenceData.error || "An unexpected error occurred"}.
                                                    </Typography>
                                                ) : transcriptData?.status !== "completed" ? (
                                                    <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                                                        AI Insights require a completed transcript.
                                                    </Typography>
                                                ) : null}
                                            </Box>
                                        )}

                                        <Box sx={{ display: "flex", gap: 1, width: "100%", justifyContent: "flex-end", flexWrap: "wrap" }}>
                                            {rec.status === "ready" && (
                                                <>
                                                    <Button
                                                        size="small"
                                                        variant={isPlaying ? "contained" : "outlined"}
                                                        startIcon={<PlayArrowIcon />}
                                                        onClick={() => setPlayingRecordingId(isPlaying ? null : rec._id)}
                                                    >
                                                        {isPlaying ? "Close Player" : "Play"}
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        variant={selectedTranscriptRecordingId === rec._id ? "contained" : "outlined"}
                                                        startIcon={<SubtitlesIcon />}
                                                        onClick={() => handleOpenTranscript(selectedRecordingsMeetingCode, rec._id)}
                                                    >
                                                        {selectedTranscriptRecordingId === rec._id ? "Hide Transcript" : "Transcript"}
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        startIcon={<DownloadIcon />}
                                                        href={mediaUrl}
                                                        download={`recording_${selectedRecordingsMeetingCode}_${rec._id}.webm`}
                                                        target="_blank"
                                                    >
                                                        Download
                                                    </Button>
                                                </>
                                            )}
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="error"
                                                startIcon={<DeleteIcon />}
                                                onClick={() => handleDeleteRecording(selectedRecordingsMeetingCode, rec._id)}
                                            >
                                                Delete
                                            </Button>
                                        </Box>
                                    </ListItem>
                                );
                            })}
                        </List>
                    ) : (
                        <Typography color="text.secondary" sx={{ p: 2 }}>No recordings available for this meeting.</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseRecordings}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default withAuth(History);
