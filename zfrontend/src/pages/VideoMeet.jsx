import React, { useEffect, useRef, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from "socket.io-client";
import {
    Badge,
    IconButton,
    TextField,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControlLabel,
    Switch,
    Typography,
    Box,
    Chip,
    Drawer,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Tooltip,
    Alert,
    Tabs,
    Tab,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    CircularProgress
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopCircleIcon from '@mui/icons-material/StopCircle';

import styles from "../styles/videoComponent.module.css";
import server from '../environment';
import { apiClient } from '../services/apiClient';
import { AuthContext } from '../contexts/AuthContext';

import P2PRealtimeProvider from '../realtime/P2PRealtimeProvider';
import LiveKitRealtimeProvider from '../realtime/LiveKitRealtimeProvider';
const server_url = server;

export default function VideoMeetComponent() {
    const { url } = useParams();
    const navigate = useNavigate();
    const { userData } = useContext(AuthContext) || {};

    const meetingCode = url ? url.trim() : window.location.pathname.substring(1);

    var socketRef = useRef();
    let socketIdRef = useRef();
    let localVideoref = useRef();
    const videoRef = useRef([]);
    const realtimeProviderRef = useRef(null);

    // Media & UI States
    const [videoAvailable, setVideoAvailable] = useState(true);
    const [audioAvailable, setAudioAvailable] = useState(true);
    const [video, setVideo] = useState(true);
    const [audio, setAudio] = useState(true);
    const [screen, setScreen] = useState(false);
    const [screenAvailable, setScreenAvailable] = useState(false);
    const [videos, setVideos] = useState([]);

    // Lobby & Meeting Info States
    const [askForUsername, setAskForUsername] = useState(true);
    const [username, setUsername] = useState(userData?.name || userData?.username || "");
    const [meetingDetails, setMeetingDetails] = useState(null);
    const [meetingEnded, setMeetingEnded] = useState(false);
    const [isHost, setIsHost] = useState(false);
    const [isInWaitingRoom, setIsInWaitingRoom] = useState(false);

    // Meeting Settings States (Defaults)
    const [meetingSettings, setMeetingSettings] = useState({
        allowGuestAccess: true,
        waitingRoomEnabled: false,
        allowScreenShare: true,
        allowChat: true,
        allowParticipantUnmute: true
    });

    // Chat States
    const [showModal, setModal] = useState(false);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [newMessages, setNewMessages] = useState(0);

    // Phase 6: Advanced Chat States
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editingContent, setEditingContent] = useState("");
    const [typingUsers, setTypingUsers] = useState([]);
    const [isTypingSelf, setIsTypingSelf] = useState(false);
    const typingTimeoutRef = useRef(null);

    // Participants & Moderation States
    const [participantPanelOpen, setParticipantPanelOpen] = useState(false);
    const [participantsList, setParticipantsList] = useState([]);
    const [waitingParticipants, setWaitingParticipants] = useState([]);
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const [endMeetingDialogOpen, setEndMeetingDialogOpen] = useState(false);

    // Phase 5: Collaboration Workspace States
    const [workspaceDrawerOpen, setWorkspaceDrawerOpen] = useState(false);
    const [workspaceTab, setWorkspaceTab] = useState(0); // 0: Notes, 1: Agenda, 2: Tasks, 3: Resources
    const [workspaceData, setWorkspaceData] = useState({
        notes: { content: "", version: 1 },
        agenda: [],
        tasks: [],
        resources: []
    });
    const [notesContent, setNotesContent] = useState("");
    const [savingNotes, setSavingNotes] = useState(false);
    const [orgMembers, setOrgMembers] = useState([]);

    // Phase 7: Meeting Recording States
    const [isRecording, setIsRecording] = useState(false);
    const [recordingId, setRecordingId] = useState(null);
    const [recordingStartedAt, setRecordingStartedAt] = useState(null);
    const [recordingTimer, setRecordingTimer] = useState("00:00");
    const [isFinalizingRecording, setIsFinalizingRecording] = useState(false);
    // Phase 8: Transcription status notification state
    const [transcriptionStatus, setTranscriptionStatus] = useState(null);
    const mediaRecorderRef = useRef(null);
    const recordingChunksRef = useRef([]);

    // Form states for adding items
    const [newAgendaTitle, setNewAgendaTitle] = useState("");
    const [newAgendaDesc, setNewAgendaDesc] = useState("");
    const [newAgendaDuration, setNewAgendaDuration] = useState(15);

    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskDesc, setNewTaskDesc] = useState("");
    const [newTaskAssignee, setNewTaskAssignee] = useState("");
    const [newTaskDueDate, setNewTaskDueDate] = useState("");

    const [newResourceTitle, setNewResourceTitle] = useState("");
    const [newResourceUrl, setNewResourceUrl] = useState("");
    const [newResourceType, setNewResourceType] = useState("link");
    const [newResourceDesc, setNewResourceDesc] = useState("");

    // Fetch Meeting Details & Workspace on Mount
    useEffect(() => {
        const fetchMeetingAndWorkspace = async () => {
            try {
                const res = await apiClient.get(`/meetings/${meetingCode}`);
                const data = res.data;
                setMeetingDetails(data);
                if (data.status === "ended") {
                    setMeetingEnded(true);
                }
                if (data.settings) {
                    setMeetingSettings(data.settings);
                }
                if (data.isHost) {
                    setIsHost(true);
                }

                // Phase 7: Restore active recording if one exists
                if (data.recordings && data.recordings.length > 0) {
                    const activeRec = data.recordings.find(r => r.status === "recording");
                    if (activeRec) {
                        setIsRecording(true);
                        setRecordingId(activeRec._id);
                        setRecordingStartedAt(activeRec.startedAt);
                    }
                }

                // Fetch Workspace
                const wsRes = await apiClient.get(`/meetings/${meetingCode}/workspace`);
                setWorkspaceData(wsRes.data.workspace);
                setNotesContent(wsRes.data.workspace?.notes?.content || "");

                // Fetch Organization Members if org exists and user authenticated
                if (data.organization?.id) {
                    try {
                        const membersRes = await apiClient.get(`/organizations/${data.organization.id}/members`);
                        setOrgMembers(membersRes.data.members || []);
                    } catch (e) { }
                }

                // Fetch Messages (Phase 6)
                try {
                    const msgRes = await apiClient.get(`/meetings/${meetingCode}/messages`);
                    setMessages((msgRes.data.messages || []).map(m => ({
                        ...m,
                        data: m.message,
                        sender: m.senderName || m.sender
                    })));
                } catch (e) { }
            } catch (err) {
                console.log("Could not load meeting metadata:", err.message);
            }
        };
        fetchMeetingAndWorkspace();
    }, [meetingCode]);

    // Phase 7: Resilient Recording Timer (derived from server startedAt)
    useEffect(() => {
        let interval = null;
        if (isRecording && recordingStartedAt) {
            const updateTimer = () => {
                const start = new Date(recordingStartedAt).getTime();
                const now = Date.now();
                const diffSec = Math.max(0, Math.floor((now - start) / 1000));
                const mins = String(Math.floor(diffSec / 60)).padStart(2, '0');
                const secs = String(diffSec % 60).padStart(2, '0');
                setRecordingTimer(`${mins}:${secs}`);
            };
            updateTimer();
            interval = setInterval(updateTimer, 1000);
        } else {
            setRecordingTimer("00:00");
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isRecording, recordingStartedAt]);

    // Check device permissions on mount
    useEffect(() => {
        getPermissions();
    }, []);

    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoPermission) {
                setVideoAvailable(true);
            } else {
                setVideoAvailable(false);
            }

            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (audioPermission) {
                setAudioAvailable(true);
            } else {
                setAudioAvailable(false);
            }

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            } else {
                setScreenAvailable(false);
            }

            if (videoAvailable || audioAvailable) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({
                    video: videoAvailable,
                    audio: audioAvailable
                });
                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoref.current) {
                        localVideoref.current.srcObject = userMediaStream;
                    }
                    if (realtimeProviderRef.current) {
                        realtimeProviderRef.current.replaceLocalStream(userMediaStream);
                    }
                }
            }
        } catch (error) {
            console.log("Permission error:", error);
        }
    };

    const getDislayMedia = () => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .catch((e) => console.log(e));
            }
        }
    };

    const getDislayMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop());
        } catch (e) { }

        window.localStream = stream;
        localVideoref.current.srcObject = stream;

        if (realtimeProviderRef.current) {
            realtimeProviderRef.current.replaceLocalStream(window.localStream);
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false);
            try {
                let tracks = localVideoref.current.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            } catch (e) { }

            let blackStream = black();
            window.localStream = new MediaStream([blackStream]);
            localVideoref.current.srcObject = window.localStream;
            getUserMedia();
        });
    };

    const getUserMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop());
        } catch (e) { }

        window.localStream = stream;
        localVideoref.current.srcObject = stream;

        if (realtimeProviderRef.current) {
            realtimeProviderRef.current.replaceLocalStream(window.localStream);
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);

            try {
                let tracks = localVideoref.current.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            } catch (e) { }

            let blackStream = black();
            window.localStream = new MediaStream([blackStream]);
            localVideoref.current.srcObject = window.localStream;

            if (realtimeProviderRef.current) {
                realtimeProviderRef.current.replaceLocalStream(window.localStream);
            }
        });
    };

    const getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .catch((e) => console.log(e));
        } else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            } catch (e) { }
        }
    };

    useEffect(() => {
        if (video !== undefined && audio !== undefined && !askForUsername && !isInWaitingRoom) {
            getUserMedia();
        }
    }, [video, audio, screen]);

    useEffect(() => {
        if (screen !== undefined && screen) {
            getDislayMedia();
        }
    }, [screen]);

    const black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height });
        canvas.getContext('2d').fillRect(0, 0, width, height);
        let stream = canvas.captureStream();
        return Object.assign(stream.getVideoTracks()[0], { enabled: false });
    };

    const handleVideo = () => {
        setVideo(!video);
        if (socketRef.current) {
            socketRef.current.emit("meeting:state-update", { isVideoOff: video });
        }
    };

    const handleAudio = () => {
        if (!audio && !isHost && meetingSettings.allowParticipantUnmute === false) {
            alert("The host has disabled participant unmuting for this meeting.");
            return;
        }
        setAudio(!audio);
        if (socketRef.current) {
            socketRef.current.emit("meeting:state-update", { isMuted: audio });
        }
    };

    const handleScreen = () => {
        if (!screen && !isHost && meetingSettings.allowScreenShare === false) {
            alert("Screen sharing has been disabled by the host.");
            return;
        }
        setScreen(!screen);
    };

    const handleEndCall = () => {
        if (isHost) {
            setEndMeetingDialogOpen(true);
        } else {
            leaveCall();
        }
    };

    const leaveCall = () => {
        try {
            if (localVideoref.current && localVideoref.current.srcObject) {
                let tracks = localVideoref.current.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            }
        } catch (e) { }

        if (realtimeProviderRef.current) {
            realtimeProviderRef.current.disconnect();
        }

        navigate("/");
    };

    const handleEndMeetingForAll = () => {
        if (socketRef.current) {
            socketRef.current.emit("meeting:end", { meetingCode });
        }
        leaveCall();
    };

    const addMessage = (data, sender, socketIdSender) => {
        setMessages((prevMessages) => [
            ...prevMessages,
            { sender: sender, senderName: sender, data: data, message: data, createdAt: new Date() }
        ]);
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages((prev) => prev + 1);
        }
    };

    const handleTypingChange = (e) => {
        const val = e.target.value;
        setMessage(val);
        if (!socketRef.current) return;
        if (!isTypingSelf) {
            setIsTypingSelf(true);
            socketRef.current.emit("meeting:typing-start", { meetingCode });
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setIsTypingSelf(false);
            if (socketRef.current) {
                socketRef.current.emit("meeting:typing-stop", { meetingCode });
            }
        }, 2000);
    };

    const sendMessage = () => {
        if (!meetingSettings.allowChat && !isHost) {
            alert("Chat is disabled by the host.");
            return;
        }
        if (!message.trim()) return;
        if (socketRef.current) {
            socketRef.current.emit('meeting:chat-send', {
                message: message.trim(),
                sender: username || "Participant"
            });
            if (isTypingSelf) {
                setIsTypingSelf(false);
                socketRef.current.emit("meeting:typing-stop", { meetingCode });
            }
        }
        setMessage("");
    };

    const handleEditMessage = (msg) => {
        setEditingMessageId(msg._id);
        setEditingContent(msg.message || msg.data || "");
    };

    const handleSaveEditedMessage = () => {
        if (!editingContent.trim() || !editingMessageId) return;
        if (socketRef.current) {
            socketRef.current.emit("meeting:chat-edit", {
                meetingCode,
                messageId: editingMessageId,
                message: editingContent.trim()
            });
        }
        setEditingMessageId(null);
        setEditingContent("");
    };

    const handleDeleteMessage = (msgId) => {
        if (socketRef.current) {
            socketRef.current.emit("meeting:chat-delete", {
                meetingCode,
                messageId: msgId
            });
        }
    };

    const handleReactMessage = (msgId, emoji) => {
        if (!userData) return;
        if (socketRef.current) {
            socketRef.current.emit("meeting:chat-react", {
                meetingCode,
                messageId: msgId,
                emoji
            });
        }
    };

    // Phase 7: MediaRecorder & Recording Lifecycle Handlers
    const getSupportedMimeType = () => {
        if (typeof MediaRecorder === 'undefined') return null;
        const types = [
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=h264,opus',
            'video/webm',
            'video/mp4'
        ];
        for (const t of types) {
            if (MediaRecorder.isTypeSupported(t)) return t;
        }
        return '';
    };

    const handleStartRecording = async () => {
        if (!isHost) return;
        const mimeType = getSupportedMimeType();
        if (!mimeType) {
            alert("Browser does not support MediaRecorder or WebM recording.");
            return;
        }

        try {
            // 1. Request server to start recording
            const res = await apiClient.post(`/meetings/${meetingCode}/recordings/start`);
            const recData = res.data.recording;

            setIsRecording(true);
            setRecordingId(recData._id);
            setRecordingStartedAt(recData.startedAt);

            // 2. Start MediaRecorder with localStream
            const streamToRecord = window.localStream;
            if (!streamToRecord || streamToRecord.getTracks().length === 0) {
                console.warn("No active local stream available to record.");
            }

            recordingChunksRef.current = [];
            const recorder = new MediaRecorder(streamToRecord, { mimeType });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    recordingChunksRef.current.push(e.data);
                }
            };

            recorder.start(1000); // Collect 1-second chunks

            // Notify peers via socket
            if (socketRef.current) {
                socketRef.current.emit("meeting:recording-start", { meetingCode });
            }
        } catch (err) {
            console.error("Failed to start recording:", err);
            alert(err.response?.data?.message || "Failed to start recording.");
        }
    };

    const handleStopRecording = async () => {
        if (!isHost || !recordingId) return;
        setIsFinalizingRecording(true);
        setIsRecording(false);

        if (socketRef.current) {
            socketRef.current.emit("meeting:recording-stop", { meetingCode, recordingId });
        }

        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            recorder.onstop = async () => {
                try {
                    const mimeType = recorder.mimeType || 'video/webm';
                    const blob = new Blob(recordingChunksRef.current, { type: mimeType });

                    // Upload final Blob to stop endpoint
                    await apiClient.post(
                        `/meetings/${meetingCode}/recordings/${recordingId}/stop`,
                        blob,
                        {
                            headers: { 'Content-Type': mimeType }
                        }
                    );

                    if (socketRef.current) {
                        socketRef.current.emit("meeting:recording-ready", { meetingCode, recordingId });
                    }
                } catch (uploadErr) {
                    console.error("Failed to upload recording blob:", uploadErr);
                } finally {
                    setIsFinalizingRecording(false);
                    setRecordingId(null);
                    setRecordingStartedAt(null);
                    mediaRecorderRef.current = null;
                    recordingChunksRef.current = [];
                }
            };
            recorder.stop();
        } else {
            setIsFinalizingRecording(false);
            setRecordingId(null);
            setRecordingStartedAt(null);
        }
    };

    // Socket.IO Connection Setup
    const connectToSocketServer = () => {
        const token = localStorage.getItem("token") || "";
        socketRef.current = io.connect(server_url, { 
            secure: process.env.NODE_ENV === "production",
            auth: { token }
        });

        socketRef.current.on('connect', () => {
            socketIdRef.current = socketRef.current.id;

            // Send join-call with user identity metadata
            socketRef.current.emit('join-call', window.location.href, {
                username: username || "Guest",
                userId: userData?.id || null,
                isHost: isHost,
                isMuted: !audio,
                isVideoOff: !video
            });

            // Phase 7: Realtime Recording State Listeners
            socketRef.current.on('meeting:recording-state', (state) => {
                setIsRecording(state.isRecording);
                setRecordingId(state.recordingId || null);
                setRecordingStartedAt(state.startedAt || null);
            });

            socketRef.current.on('meeting:recording-started', (data) => {
                setIsRecording(true);
                setRecordingId(data.recordingId);
                setRecordingStartedAt(data.startedAt);
            });

            socketRef.current.on('meeting:recording-stopped', () => {
                setIsRecording(false);
            });

            socketRef.current.on('meeting:recording-ready', () => {
                setIsFinalizingRecording(false);
            });

            // Phase 8: Realtime Transcription State Listeners
            socketRef.current.on('meeting:transcription-started', (data) => {
                setTranscriptionStatus({ status: 'queued', recordingId: data.recordingId, provider: data.provider });
            });

            socketRef.current.on('meeting:transcription-processing', (data) => {
                setTranscriptionStatus({ status: 'processing', recordingId: data.recordingId, provider: data.provider });
            });

            socketRef.current.on('meeting:transcription-completed', (data) => {
                setTranscriptionStatus({ status: 'completed', recordingId: data.recordingId, provider: data.provider, duration: data.duration });
            });

            socketRef.current.on('meeting:transcription-failed', (data) => {
                setTranscriptionStatus({ status: 'failed', recordingId: data.recordingId, provider: data.provider, error: data.error });
            });

            // Chat listeners (Phase 4 legacy & Phase 6 persistent)
            socketRef.current.on('chat-message', (data, sender, socketIdSender) => {
                // If legacy chat arrives
                addMessage(data, sender, socketIdSender);
            });

            socketRef.current.on('meeting:chat-message', (newMsg) => {
                setMessages((prev) => {
                    if (newMsg._id && prev.some(m => m._id === newMsg._id)) return prev;
                    return [...prev, { ...newMsg, data: newMsg.message, sender: newMsg.senderName || newMsg.sender }];
                });
                if (newMsg.sender !== userData?.id && (!socketIdRef.current || newMsg.socketIdSender !== socketIdRef.current)) {
                    setNewMessages((prev) => prev + 1);
                }
            });

            socketRef.current.on('meeting:chat-edited', (editedMsg) => {
                setMessages((prev) => prev.map(m => (m._id === editedMsg._id ? { ...m, ...editedMsg, data: editedMsg.message } : m)));
            });

            socketRef.current.on('meeting:chat-deleted', ({ messageId }) => {
                setMessages((prev) => prev.map(m => (m._id === messageId ? { ...m, isDeleted: true, message: "This message was deleted", data: "This message was deleted" } : m)));
            });

            socketRef.current.on('meeting:reaction-updated', ({ messageId, reactions }) => {
                setMessages((prev) => prev.map(m => (m._id === messageId ? { ...m, reactions } : m)));
            });

            socketRef.current.on('meeting:user-typing', ({ socketId, username, isTyping }) => {
                setTypingUsers((prev) => {
                    if (isTyping) {
                        if (!prev.some(u => u.socketId === socketId)) {
                            return [...prev, { socketId, username }];
                        }
                        return prev;
                    } else {
                        return prev.filter(u => u.socketId !== socketId);
                    }
                });
            });

            // Instantiate the provider
            const providerType = process.env.REACT_APP_REALTIME_PROVIDER || "p2p";
            if (providerType === "p2p") {
                realtimeProviderRef.current = new P2PRealtimeProvider();
            } else if (providerType === "livekit") {
                realtimeProviderRef.current = new LiveKitRealtimeProvider();
            } else {
                realtimeProviderRef.current = new P2PRealtimeProvider(); 
            }

            realtimeProviderRef.current.onParticipantsUpdated((videosList) => {
                setVideos([...videosList]);
                videoRef.current = [...videosList];
            });

            realtimeProviderRef.current.connect({
                socket: socketRef.current,
                socketId: socketIdRef.current,
                localStream: window.localStream
            }).catch(error => {
                alert(`Realtime Connection Error: ${error.message}`);
            });

            // Real-time participant list
            socketRef.current.on('meeting:participants-list', (list) => {
                setParticipantsList(list);
            });

            // Host moderation events
            socketRef.current.on('meeting:participant-muted', () => {
                setAudio(false);
                if (localVideoref.current && localVideoref.current.srcObject) {
                    localVideoref.current.srcObject.getAudioTracks().forEach(t => t.enabled = false);
                }
            });

            socketRef.current.on('meeting:participant-removed', (data) => {
                alert(data?.message || "You have been removed from the meeting by the host.");
                leaveCall();
            });

            socketRef.current.on('meeting:ended', (data) => {
                alert(data?.message || "The meeting has been ended by the host.");
                leaveCall();
            });

            socketRef.current.on('meeting:settings-updated', (newSettings) => {
                setMeetingSettings(newSettings);
            });

            socketRef.current.on('meeting:in-waiting-room', () => {
                setIsInWaitingRoom(true);
            });

            socketRef.current.on('meeting:waiting-participant', (waiting) => {
                setWaitingParticipants((prev) => {
                    if (!prev.some(p => p.socketId === waiting.socketId)) {
                        return [...prev, waiting];
                    }
                    return prev;
                });
            });

            socketRef.current.on('meeting:join-approved', () => {
                setIsInWaitingRoom(false);
                setAskForUsername(false);
                getUserMedia();
            });

            socketRef.current.on('meeting:join-rejected', (data) => {
                alert(data?.message || "Admission denied by host.");
                leaveCall();
            });

            socketRef.current.on('meeting:chat-disabled', (data) => {
                alert(data?.message || "Chat is disabled by the host.");
            });

            // Phase 5: Real-time Workspace Synchronization Listeners
            socketRef.current.on('meeting:notes-updated', (notes) => {
                setWorkspaceData(prev => ({ ...prev, notes }));
                setNotesContent(notes.content || "");
            });

            socketRef.current.on('meeting:agenda-updated', (agenda) => {
                setWorkspaceData(prev => ({ ...prev, agenda }));
            });

            socketRef.current.on('meeting:task-updated', (tasks) => {
                setWorkspaceData(prev => ({ ...prev, tasks }));
            });

            socketRef.current.on('meeting:resource-updated', (resources) => {
                setWorkspaceData(prev => ({ ...prev, resources }));
            });

            // Phase 8: Transcription lifecycle socket listeners
            // REST API is the authoritative state source. These socket events are
            // only for real-time UI feedback — they do NOT replace polling/fetching.
            // On refresh or late-join, the client must re-fetch from the REST status endpoint.
            socketRef.current.on('meeting:transcription-started', (data) => {
                setTranscriptionStatus({ status: 'queued', ...data });
            });

            socketRef.current.on('meeting:transcription-processing', (data) => {
                setTranscriptionStatus({ status: 'processing', ...data });
            });

            socketRef.current.on('meeting:transcription-completed', (data) => {
                setTranscriptionStatus({ status: 'completed', ...data });
            });

            socketRef.current.on('meeting:transcription-failed', (data) => {
                // Only show safe metadata — provider secrets and raw stack traces
                // are never included in socket payloads (see socketManager.js)
                setTranscriptionStatus({ status: 'failed', ...data });
            });
        });
    };

    const connect = () => {
        setAskForUsername(false);
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();
    };

    // Host Moderation Actions
    const handleMuteParticipant = (targetSocketId) => {
        if (socketRef.current) {
            socketRef.current.emit('meeting:mute-participant', {
                targetSocketId,
                meetingCode
            });
        }
    };

    const handleRemoveParticipant = (targetSocketId) => {
        if (socketRef.current) {
            socketRef.current.emit('meeting:remove-participant', {
                targetSocketId,
                meetingCode
            });
        }
    };

    const handleApproveWaiting = (targetSocketId) => {
        if (socketRef.current) {
            socketRef.current.emit('meeting:approve-participant', {
                targetSocketId,
                meetingCode
            });
            setWaitingParticipants(prev => prev.filter(p => p.socketId !== targetSocketId));
        }
    };

    const handleRejectWaiting = (targetSocketId) => {
        if (socketRef.current) {
            socketRef.current.emit('meeting:reject-participant', {
                targetSocketId,
                meetingCode
            });
            setWaitingParticipants(prev => prev.filter(p => p.socketId !== targetSocketId));
        }
    };

    const handleSaveSettings = async () => {
        try {
            await apiClient.patch(`/meetings/${meetingCode}/settings`, {
                settings: meetingSettings
            });
            if (socketRef.current) {
                socketRef.current.emit('meeting:update-settings', {
                    meetingCode,
                    settings: meetingSettings
                });
            }
            setSettingsDialogOpen(false);
        } catch (err) {
            alert("Failed to update settings: " + (err.response?.data?.message || err.message));
        }
    };

    // ==========================================
    // PHASE 5: WORKSPACE COLLABORATION HANDLERS
    // ==========================================

    // Notes Handlers
    const handleSaveNotes = async () => {
        if (!userData) {
            alert("Only registered members can edit notes.");
            return;
        }
        try {
            setSavingNotes(true);
            const res = await apiClient.patch(`/meetings/${meetingCode}/notes`, { content: notesContent });
            setWorkspaceData(prev => ({ ...prev, notes: res.data.notes }));
            if (socketRef.current) {
                socketRef.current.emit("meeting:notes-update", { meetingCode, content: notesContent });
            }
        } catch (err) {
            alert("Failed to save notes: " + (err.response?.data?.message || err.message));
        } finally {
            setSavingNotes(false);
        }
    };

    // Agenda Handlers
    const handleAddAgenda = async () => {
        if (!userData) {
            alert("Only registered members can add agenda items.");
            return;
        }
        if (!newAgendaTitle.trim()) return;
        try {
            const res = await apiClient.post(`/meetings/${meetingCode}/agenda`, {
                title: newAgendaTitle.trim(),
                description: newAgendaDesc.trim(),
                duration: Number(newAgendaDuration) || 0
            });
            setWorkspaceData(prev => ({ ...prev, agenda: [...(prev.agenda || []), res.data.item] }));
            setNewAgendaTitle("");
            setNewAgendaDesc("");
            if (socketRef.current) {
                socketRef.current.emit("meeting:agenda-update", { meetingCode });
            }
        } catch (err) {
            alert("Failed to add agenda item: " + (err.response?.data?.message || err.message));
        }
    };

    const handleToggleAgendaStatus = async (item) => {
        if (!userData) return;
        const nextStatus = item.status === "pending" ? "active" : item.status === "active" ? "completed" : "pending";
        try {
            const res = await apiClient.patch(`/meetings/${meetingCode}/agenda/${item._id}`, { status: nextStatus });
            setWorkspaceData(prev => ({
                ...prev,
                agenda: (prev.agenda || []).map(a => a._id === item._id ? res.data.item : a)
            }));
            if (socketRef.current) {
                socketRef.current.emit("meeting:agenda-update", { meetingCode });
            }
        } catch (err) {
            alert("Failed to update status: " + (err.response?.data?.message || err.message));
        }
    };

    const handleDeleteAgenda = async (itemId) => {
        try {
            await apiClient.delete(`/meetings/${meetingCode}/agenda/${itemId}`);
            setWorkspaceData(prev => ({
                ...prev,
                agenda: (prev.agenda || []).filter(a => a._id !== itemId)
            }));
            if (socketRef.current) {
                socketRef.current.emit("meeting:agenda-update", { meetingCode });
            }
        } catch (err) {
            alert("Failed to delete agenda item: " + (err.response?.data?.message || err.message));
        }
    };

    // Tasks Handlers
    const handleCreateTask = async () => {
        if (!userData) {
            alert("Only registered members can create tasks.");
            return;
        }
        if (!newTaskTitle.trim()) return;
        try {
            const res = await apiClient.post(`/meetings/${meetingCode}/tasks`, {
                title: newTaskTitle.trim(),
                description: newTaskDesc.trim(),
                assignedTo: newTaskAssignee || undefined,
                dueDate: newTaskDueDate || undefined
            });
            setWorkspaceData(prev => ({ ...prev, tasks: [...(prev.tasks || []), res.data.task] }));
            setNewTaskTitle("");
            setNewTaskDesc("");
            setNewTaskAssignee("");
            setNewTaskDueDate("");
            if (socketRef.current) {
                socketRef.current.emit("meeting:task-update", { meetingCode });
            }
        } catch (err) {
            alert("Failed to create task: " + (err.response?.data?.message || err.message));
        }
    };

    const handleToggleTaskStatus = async (task) => {
        if (!userData) return;
        const nextStatus = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "completed" : "todo";
        try {
            const res = await apiClient.patch(`/meetings/${meetingCode}/tasks/${task._id}`, { status: nextStatus });
            setWorkspaceData(prev => ({
                ...prev,
                tasks: (prev.tasks || []).map(t => t._id === task._id ? res.data.task : t)
            }));
            if (socketRef.current) {
                socketRef.current.emit("meeting:task-update", { meetingCode });
            }
        } catch (err) {
            alert("Failed to update task: " + (err.response?.data?.message || err.message));
        }
    };

    const handleDeleteTask = async (taskId) => {
        try {
            await apiClient.delete(`/meetings/${meetingCode}/tasks/${taskId}`);
            setWorkspaceData(prev => ({
                ...prev,
                tasks: (prev.tasks || []).filter(t => t._id !== taskId)
            }));
            if (socketRef.current) {
                socketRef.current.emit("meeting:task-update", { meetingCode });
            }
        } catch (err) {
            alert("Failed to delete task: " + (err.response?.data?.message || err.message));
        }
    };

    // Resources Handlers
    const handleAddResource = async () => {
        if (!userData) {
            alert("Only registered members can add resources.");
            return;
        }
        if (!newResourceTitle.trim() || !newResourceUrl.trim()) return;
        if (!newResourceUrl.startsWith("http://") && !newResourceUrl.startsWith("https://")) {
            alert("Resource URL must begin with http:// or https://");
            return;
        }
        try {
            const res = await apiClient.post(`/meetings/${meetingCode}/resources`, {
                title: newResourceTitle.trim(),
                url: newResourceUrl.trim(),
                type: newResourceType,
                description: newResourceDesc.trim()
            });
            setWorkspaceData(prev => ({ ...prev, resources: [...(prev.resources || []), res.data.resource] }));
            setNewResourceTitle("");
            setNewResourceUrl("");
            setNewResourceDesc("");
            if (socketRef.current) {
                socketRef.current.emit("meeting:resource-update", { meetingCode });
            }
        } catch (err) {
            alert("Failed to add resource: " + (err.response?.data?.message || err.message));
        }
    };

    const handleDeleteResource = async (resourceId) => {
        try {
            await apiClient.delete(`/meetings/${meetingCode}/resources/${resourceId}`);
            setWorkspaceData(prev => ({
                ...prev,
                resources: (prev.resources || []).filter(r => r._id !== resourceId)
            }));
            if (socketRef.current) {
                socketRef.current.emit("meeting:resource-update", { meetingCode });
            }
        } catch (err) {
            alert("Failed to delete resource: " + (err.response?.data?.message || err.message));
        }
    };

    // Render: Meeting Ended Screen
    if (meetingEnded) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#010430', color: 'white', gap: 2 }}>
                <Typography variant="h4">Meeting Ended</Typography>
                <Typography variant="body1">This meeting has already concluded.</Typography>
                <Button variant="contained" onClick={() => navigate("/")}>Return Home</Button>
            </Box>
        );
    }

    // Render: Waiting Room Screen
    if (isInWaitingRoom) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#010430', color: 'white', gap: 2 }}>
                <Typography variant="h4">Please Wait</Typography>
                <Typography variant="body1">The meeting host will let you in soon.</Typography>
                <Button variant="outlined" color="error" onClick={leaveCall}>Leave Waiting Room</Button>
            </Box>
        );
    }

    return (
        <div>
            {askForUsername === true ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', background: '#010430', minHeight: '100vh', color: 'white' }}>
                    <h2>{meetingDetails?.title || "Enter into Lobby"}</h2>
                    {meetingDetails?.description && (
                        <p style={{ color: '#ccc', marginBottom: '20px' }}>{meetingDetails.description}</p>
                    )}

                    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                        <TextField
                            id="outlined-basic"
                            label="Your Display Name"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            variant="outlined"
                            sx={{ background: 'white', borderRadius: 1 }}
                        />
                        <Button variant="contained" size="large" onClick={connect}>Connect</Button>
                    </Box>

                    <div style={{ width: '480px', maxWidth: '90vw', borderRadius: '10px', overflow: 'hidden', border: '2px solid #333' }}>
                        <video ref={localVideoref} autoPlay muted style={{ width: '100%', display: 'block' }}></video>
                    </div>
                </div>
            ) : (
                <div className={styles.meetVideoContainer}>
                    {/* In-Meeting Chat Drawer */}
                    {showModal && (
                        <div className={styles.chatRoom}>
                            <div className={styles.chatContainer}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <h3>In-Meeting Chat</h3>
                                    <IconButton size="small" onClick={() => setModal(false)}>
                                        <CloseIcon />
                                    </IconButton>
                                </Box>

                                {!meetingSettings.allowChat && (
                                    <Alert severity="warning" sx={{ mb: 1 }}>Chat is disabled by the host.</Alert>
                                )}

                                <div className={styles.chattingDisplay}>
                                    {messages.length !== 0 ? messages.map((item, index) => (
                                        <div style={{ marginBottom: "14px", paddingBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.05)" }} key={item._id || index}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <span style={{ fontWeight: "bold", fontSize: "13px" }}>{item.senderName || item.sender}</span>
                                                    {item.createdAt && (
                                                        <span style={{ fontSize: "11px", color: "#888" }}>
                                                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                    {item.isEdited && !item.isDeleted && (
                                                        <span style={{ fontSize: "10px", color: "#aaa" }}>(edited)</span>
                                                    )}
                                                </Box>

                                                {/* Edit & Delete Controls */}
                                                {!item.isDeleted && (
                                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                        {userData && item.sender === userData?.id && (
                                                            <IconButton size="small" onClick={() => handleEditMessage(item)} sx={{ p: 0.3, color: '#aaa' }}>
                                                                <EditIcon sx={{ fontSize: 14 }} />
                                                            </IconButton>
                                                        )}
                                                        {userData && (item.sender === userData?.id || isHost) && (
                                                            <IconButton size="small" onClick={() => handleDeleteMessage(item._id)} sx={{ p: 0.3, color: '#f44336' }}>
                                                                <DeleteIcon sx={{ fontSize: 14 }} />
                                                            </IconButton>
                                                        )}
                                                    </Box>
                                                )}
                                            </Box>

                                            {/* Message Content or Edit Input */}
                                            {editingMessageId === item._id ? (
                                                <Box sx={{ display: 'flex', gap: 1, my: 1 }}>
                                                    <TextField
                                                        size="small"
                                                        fullWidth
                                                        value={editingContent}
                                                        onChange={e => setEditingContent(e.target.value)}
                                                        onKeyPress={e => e.key === 'Enter' && handleSaveEditedMessage()}
                                                    />
                                                    <Button size="small" variant="contained" onClick={handleSaveEditedMessage}>Save</Button>
                                                    <Button size="small" onClick={() => setEditingMessageId(null)}>Cancel</Button>
                                                </Box>
                                            ) : (
                                                <p style={{
                                                    margin: "4px 0",
                                                    fontSize: "13px",
                                                    fontStyle: item.isDeleted ? "italic" : "normal",
                                                    color: item.isDeleted ? "#888" : "inherit"
                                                }}>
                                                    {item.message || item.data}
                                                </p>
                                            )}

                                            {/* Reactions */}
                                            {item.reactions && item.reactions.length > 0 && (
                                                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                                                    {Array.from(new Set(item.reactions.map(r => r.emoji))).map((emoji, rIdx) => {
                                                        const count = item.reactions.filter(r => r.emoji === emoji).length;
                                                        const userReacted = item.reactions.some(r => r.emoji === emoji && r.user === userData?.id);
                                                        return (
                                                            <Chip
                                                                key={rIdx}
                                                                label={`${emoji} ${count}`}
                                                                size="small"
                                                                color={userReacted ? "primary" : "default"}
                                                                variant={userReacted ? "filled" : "outlined"}
                                                                onClick={() => handleReactMessage(item._id, emoji)}
                                                                sx={{ cursor: 'pointer', height: '22px', fontSize: '11px' }}
                                                            />
                                                        );
                                                    })}
                                                </Box>
                                            )}

                                            {/* Quick Reaction Picker */}
                                            {userData && !item.isDeleted && item._id && (
                                                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                                    {['👍', '❤️', '😂', '🎉'].map(emoji => (
                                                        <span
                                                            key={emoji}
                                                            style={{ cursor: 'pointer', fontSize: '13px', opacity: 0.7 }}
                                                            onClick={() => handleReactMessage(item._id, emoji)}
                                                            title={`React ${emoji}`}
                                                        >
                                                            {emoji}
                                                        </span>
                                                    ))}
                                                </Box>
                                            )}
                                        </div>
                                    )) : <p>No Messages Yet</p>}

                                    {/* Typing Indicator */}
                                    {typingUsers.length > 0 && (
                                        <Typography variant="caption" sx={{ fontStyle: 'italic', color: '#888', display: 'block', mt: 1 }}>
                                            {typingUsers.map(u => u.username).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                                        </Typography>
                                    )}
                                </div>

                                {!userData ? (
                                    <Alert severity="info" sx={{ mt: 1, fontSize: '12px' }}>Guests have read-only chat access.</Alert>
                                ) : (
                                    <div className={styles.chattingArea}>
                                        <TextField
                                            size="small"
                                            disabled={!meetingSettings.allowChat && !isHost}
                                            value={message}
                                            onChange={handleTypingChange}
                                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                            placeholder={!meetingSettings.allowChat && !isHost ? "Chat disabled" : "Enter message"}
                                            variant="outlined"
                                            sx={{ width: '70%' }}
                                        />
                                        <Button
                                            variant='contained'
                                            disabled={!meetingSettings.allowChat && !isHost}
                                            onClick={sendMessage}
                                        >
                                            Send
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Participant & Moderation Panel Drawer */}
                    <Drawer
                        anchor="right"
                        open={participantPanelOpen}
                        onClose={() => setParticipantPanelOpen(false)}
                    >
                        <Box sx={{ width: 320, p: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6">
                                    Participants ({participantsList.length})
                                </Typography>
                                <IconButton size="small" onClick={() => setParticipantPanelOpen(false)}>
                                    <CloseIcon />
                                </IconButton>
                            </Box>

                            {/* Waiting Room Queue for Host */}
                            {isHost && waitingParticipants.length > 0 && (
                                <Box sx={{ mb: 2, p: 1, background: '#f5f5f5', borderRadius: 1 }}>
                                    <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                                        Waiting Room ({waitingParticipants.length})
                                    </Typography>
                                    <List dense>
                                        {waitingParticipants.map((p) => (
                                            <ListItem key={p.socketId}>
                                                <ListItemText primary={p.username} />
                                                <ListItemSecondaryAction>
                                                    <IconButton size="small" color="success" onClick={() => handleApproveWaiting(p.socketId)}>
                                                        <CheckIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton size="small" color="error" onClick={() => handleRejectWaiting(p.socketId)}>
                                                        <CloseIcon fontSize="small" />
                                                    </IconButton>
                                                </ListItemSecondaryAction>
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            )}

                            {/* In-Meeting Active Participants */}
                            <List dense>
                                {participantsList.map((p) => {
                                    const isSelf = p.socketId === socketIdRef.current;
                                    return (
                                        <ListItem key={p.socketId} divider>
                                            <ListItemText
                                                primary={
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <span>{p.username}</span>
                                                        {isSelf && <Chip label="You" size="small" />}
                                                        {p.isHost && <Chip label="Host" color="primary" size="small" />}
                                                    </Box>
                                                }
                                                secondary={p.isMuted ? "Muted" : "Unmuted"}
                                            />
                                            {isHost && !isSelf && (
                                                <ListItemSecondaryAction>
                                                    <Tooltip title="Mute Participant">
                                                        <IconButton size="small" onClick={() => handleMuteParticipant(p.socketId)}>
                                                            <MicOffIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Remove Participant">
                                                        <IconButton size="small" color="error" onClick={() => handleRemoveParticipant(p.socketId)}>
                                                            <PersonRemoveIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </ListItemSecondaryAction>
                                            )}
                                        </ListItem>
                                    );
                                })}
                            </List>
                        </Box>
                    </Drawer>

                    {/* Phase 5: Collaboration Workspace Drawer */}
                    <Drawer
                        anchor="right"
                        open={workspaceDrawerOpen}
                        onClose={() => setWorkspaceDrawerOpen(false)}
                    >
                        <Box sx={{ width: 380, maxWidth: "90vw", p: 2, display: "flex", flexDirection: "column", height: "100%" }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <AssignmentIcon color="primary" /> Workspace
                                </Typography>
                                <IconButton size="small" onClick={() => setWorkspaceDrawerOpen(false)}>
                                    <CloseIcon />
                                </IconButton>
                            </Box>

                            {!userData && (
                                <Alert severity="info" sx={{ mb: 1 }}>
                                    Guest mode: Workspace is read-only.
                                </Alert>
                            )}

                            <Tabs
                                value={workspaceTab}
                                onChange={(e, v) => setWorkspaceTab(v)}
                                variant="fullWidth"
                                sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
                            >
                                <Tab label="Notes" />
                                <Tab label={`Agenda (${workspaceData.agenda?.length || 0})`} />
                                <Tab label={`Tasks (${workspaceData.tasks?.length || 0})`} />
                                <Tab label={`Links (${workspaceData.resources?.length || 0})`} />
                            </Tabs>

                            {/* TAB 0: Shared Notes */}
                            {workspaceTab === 0 && (
                                <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                                        Version {workspaceData.notes?.version || 1} • Last updated: {workspaceData.notes?.updatedAt ? new Date(workspaceData.notes.updatedAt).toLocaleTimeString() : "Never"}
                                    </Typography>
                                    <TextField
                                        multiline
                                        rows={14}
                                        fullWidth
                                        disabled={!userData}
                                        value={notesContent}
                                        onChange={(e) => setNotesContent(e.target.value)}
                                        placeholder={userData ? "Type shared meeting notes here..." : "No notes or read-only."}
                                        variant="outlined"
                                        sx={{ mb: 2, flexGrow: 1 }}
                                    />
                                    {userData && (
                                        <Button
                                            variant="contained"
                                            onClick={handleSaveNotes}
                                            disabled={savingNotes}
                                        >
                                            {savingNotes ? "Saving..." : "Save Notes"}
                                        </Button>
                                    )}
                                </Box>
                            )}

                            {/* TAB 1: Agenda */}
                            {workspaceTab === 1 && (
                                <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1, overflowY: "auto" }}>
                                    {userData && (
                                        <Box sx={{ mb: 2, p: 1.5, background: "#f5f5f5", borderRadius: 1 }}>
                                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Add Agenda Item</Typography>
                                            <TextField
                                                size="small"
                                                fullWidth
                                                label="Title"
                                                value={newAgendaTitle}
                                                onChange={(e) => setNewAgendaTitle(e.target.value)}
                                                sx={{ mb: 1 }}
                                            />
                                            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                                                <TextField
                                                    size="small"
                                                    type="number"
                                                    label="Minutes"
                                                    value={newAgendaDuration}
                                                    onChange={(e) => setNewAgendaDuration(e.target.value)}
                                                    sx={{ width: 100 }}
                                                />
                                                <TextField
                                                    size="small"
                                                    fullWidth
                                                    label="Notes (Optional)"
                                                    value={newAgendaDesc}
                                                    onChange={(e) => setNewAgendaDesc(e.target.value)}
                                                />
                                            </Box>
                                            <Button size="small" variant="contained" onClick={handleAddAgenda}>
                                                Add Item
                                            </Button>
                                        </Box>
                                    )}

                                    <List dense>
                                        {(workspaceData.agenda || []).map((item, idx) => (
                                            <ListItem key={item._id || idx} divider>
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                            <span><strong>{item.order || idx + 1}.</strong> {item.title}</span>
                                                            <Chip
                                                                label={item.status?.toUpperCase()}
                                                                size="small"
                                                                clickable={Boolean(userData)}
                                                                onClick={() => handleToggleAgendaStatus(item)}
                                                                color={item.status === "completed" ? "success" : item.status === "active" ? "primary" : "default"}
                                                            />
                                                            {item.duration > 0 && (
                                                                <Typography variant="caption" color="text.secondary">
                                                                    ({item.duration}m)
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    }
                                                    secondary={item.description || null}
                                                />
                                                {(isHost || item.createdBy === userData?.id) && (
                                                    <ListItemSecondaryAction>
                                                        <IconButton size="small" color="error" onClick={() => handleDeleteAgenda(item._id)}>
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </ListItemSecondaryAction>
                                                )}
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            )}

                            {/* TAB 2: Action Items / Tasks */}
                            {workspaceTab === 2 && (
                                <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1, overflowY: "auto" }}>
                                    {userData && (
                                        <Box sx={{ mb: 2, p: 1.5, background: "#f5f5f5", borderRadius: 1 }}>
                                            <Typography variant="subtitle2" sx={{ mb: 1 }}>New Action Item</Typography>
                                            <TextField
                                                size="small"
                                                fullWidth
                                                label="Task Title"
                                                value={newTaskTitle}
                                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                                sx={{ mb: 1 }}
                                            />
                                            <TextField
                                                size="small"
                                                fullWidth
                                                label="Description (Optional)"
                                                value={newTaskDesc}
                                                onChange={(e) => setNewTaskDesc(e.target.value)}
                                                sx={{ mb: 1 }}
                                            />
                                            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                                                <FormControl size="small" fullWidth>
                                                    <InputLabel>Assignee</InputLabel>
                                                    <Select
                                                        value={newTaskAssignee}
                                                        label="Assignee"
                                                        onChange={(e) => setNewTaskAssignee(e.target.value)}
                                                    >
                                                        <MenuItem value=""><em>Unassigned</em></MenuItem>
                                                        {orgMembers.map(m => (
                                                            <MenuItem key={m.id} value={m.id}>
                                                                {m.name || m.username} ({m.role})
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                                <TextField
                                                    size="small"
                                                    type="date"
                                                    label="Due Date"
                                                    InputLabelProps={{ shrink: true }}
                                                    value={newTaskDueDate}
                                                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                                                />
                                            </Box>
                                            <Button size="small" variant="contained" onClick={handleCreateTask}>
                                                Add Task
                                            </Button>
                                        </Box>
                                    )}

                                    <List dense>
                                        {(workspaceData.tasks || []).map((task, idx) => (
                                            <ListItem key={task._id || idx} divider>
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                            <span>{task.title}</span>
                                                            <Chip
                                                                label={task.status?.replace("_", " ").toUpperCase()}
                                                                size="small"
                                                                clickable={Boolean(userData)}
                                                                onClick={() => handleToggleTaskStatus(task)}
                                                                color={task.status === "completed" ? "success" : task.status === "in_progress" ? "warning" : "default"}
                                                            />
                                                        </Box>
                                                    }
                                                    secondary={
                                                        <span>
                                                            {task.description && `${task.description} • `}
                                                            Assigned: <strong>{task.assignedTo?.name || task.assignedTo?.username || "Unassigned"}</strong>
                                                            {task.dueDate && ` • Due: ${new Date(task.dueDate).toLocaleDateString()}`}
                                                        </span>
                                                    }
                                                />
                                                {(isHost || task.createdBy === userData?.id) && (
                                                    <ListItemSecondaryAction>
                                                        <IconButton size="small" color="error" onClick={() => handleDeleteTask(task._id)}>
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </ListItemSecondaryAction>
                                                )}
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            )}

                            {/* TAB 3: Reference Resources */}
                            {workspaceTab === 3 && (
                                <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1, overflowY: "auto" }}>
                                    {userData && (
                                        <Box sx={{ mb: 2, p: 1.5, background: "#f5f5f5", borderRadius: 1 }}>
                                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Add Reference Link</Typography>
                                            <TextField
                                                size="small"
                                                fullWidth
                                                label="Title"
                                                value={newResourceTitle}
                                                onChange={(e) => setNewResourceTitle(e.target.value)}
                                                sx={{ mb: 1 }}
                                            />
                                            <TextField
                                                size="small"
                                                fullWidth
                                                label="URL (https://...)"
                                                value={newResourceUrl}
                                                onChange={(e) => setNewResourceUrl(e.target.value)}
                                                sx={{ mb: 1 }}
                                            />
                                            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                                                <FormControl size="small" sx={{ width: 140 }}>
                                                    <InputLabel>Type</InputLabel>
                                                    <Select
                                                        value={newResourceType}
                                                        label="Type"
                                                        onChange={(e) => setNewResourceType(e.target.value)}
                                                    >
                                                        <MenuItem value="link">Link</MenuItem>
                                                        <MenuItem value="document">Document</MenuItem>
                                                        <MenuItem value="repository">Repository</MenuItem>
                                                        <MenuItem value="other">Other</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <TextField
                                                    size="small"
                                                    fullWidth
                                                    label="Description (Optional)"
                                                    value={newResourceDesc}
                                                    onChange={(e) => setNewResourceDesc(e.target.value)}
                                                />
                                            </Box>
                                            <Button size="small" variant="contained" onClick={handleAddResource}>
                                                Add Resource
                                            </Button>
                                        </Box>
                                    )}

                                    <List dense>
                                        {(workspaceData.resources || []).map((resItem, idx) => (
                                            <ListItem key={resItem._id || idx} divider>
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                            <a href={resItem.url} target="_blank" rel="noopener noreferrer" style={{ color: "#1976d2", fontWeight: 600, textDecoration: "none" }}>
                                                                {resItem.title}
                                                            </a>
                                                            <Chip label={resItem.type?.toUpperCase()} size="small" variant="outlined" />
                                                        </Box>
                                                    }
                                                    secondary={
                                                        <span>
                                                            {resItem.description && `${resItem.description} • `}
                                                            {resItem.url}
                                                        </span>
                                                    }
                                                />
                                                {(isHost || resItem.createdBy === userData?.id) && (
                                                    <ListItemSecondaryAction>
                                                        <IconButton size="small" color="error" onClick={() => handleDeleteResource(resItem._id)}>
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </ListItemSecondaryAction>
                                                )}
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            )}
                        </Box>
                    </Drawer>

                    {/* Phase 7: Recording Banner Indicator (Visible to all participants) */}
                    {(isRecording || isFinalizingRecording) && (
                        <Box sx={{
                            position: 'absolute',
                            top: 20,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 1300,
                            backgroundColor: isFinalizingRecording ? 'rgba(237, 108, 2, 0.9)' : 'rgba(211, 47, 47, 0.9)',
                            color: 'white',
                            px: 2,
                            py: 0.75,
                            borderRadius: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.2,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                            backdropFilter: 'blur(4px)'
                        }}>
                            <Box sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                backgroundColor: '#fff',
                                '@keyframes blink': {
                                    '0%, 100%': { opacity: 1 },
                                    '50%': { opacity: 0.2 }
                                },
                                animation: isRecording ? 'blink 1.2s ease-in-out infinite' : 'none'
                            }} />
                            <Typography variant="body2" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>
                                {isFinalizingRecording ? "Finalizing recording..." : `REC ${recordingTimer}`}
                            </Typography>
                        </Box>
                    )}

                    {/* Phase 8: Transcription Status Banner (non-intrusive notification)
                        Socket events update this state. On page refresh the state resets,
                        but the user can check History to see persistent transcript status.
                        The banner auto-dismisses when not in queued/processing/completed state. */}
                    {transcriptionStatus && (transcriptionStatus.status === 'queued' || transcriptionStatus.status === 'processing' || transcriptionStatus.status === 'completed') && (
                        <Box sx={{
                            position: 'absolute',
                            top: (isRecording || isFinalizingRecording) ? 68 : 20,
                            right: 20,
                            zIndex: 1300,
                            backgroundColor: transcriptionStatus.status === 'completed'
                                ? 'rgba(46, 125, 50, 0.92)'
                                : 'rgba(25, 118, 210, 0.92)',
                            color: 'white',
                            px: 2,
                            py: 0.75,
                            borderRadius: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            backdropFilter: 'blur(4px)'
                        }}>
                            {transcriptionStatus.status !== 'completed' && <CircularProgress size={14} color="inherit" />}
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.78rem' }}>
                                {transcriptionStatus.status === 'completed'
                                    ? '✓ Transcript ready — view in History'
                                    : transcriptionStatus.status === 'processing'
                                    ? 'Transcription processing...'
                                    : 'Transcription queued...'}
                            </Typography>
                            <IconButton
                                size="small"
                                onClick={() => setTranscriptionStatus(null)}
                                sx={{ color: 'white', p: 0, ml: 0.5 }}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    )}


                    <div className={styles.buttonContainers}>
                        <IconButton onClick={handleVideo} style={{ color: "white" }}>
                            {video ? <VideocamIcon /> : <VideocamOffIcon />}
                        </IconButton>

                        <IconButton onClick={handleEndCall} style={{ color: "red" }}>
                            <CallEndIcon />
                        </IconButton>

                        <IconButton onClick={handleAudio} style={{ color: "white" }}>
                            {audio ? <MicIcon /> : <MicOffIcon />}
                        </IconButton>

                        {screenAvailable && (isHost || meetingSettings.allowScreenShare) && (
                            <IconButton onClick={handleScreen} style={{ color: "white" }}>
                                {screen ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                            </IconButton>
                        )}

                        <Badge badgeContent={newMessages} max={999} color='warning'>
                            <IconButton onClick={() => { setModal(!showModal); setNewMessages(0); }} style={{ color: "white" }}>
                                <ChatIcon />
                            </IconButton>
                        </Badge>

                        <Badge badgeContent={participantsList.length} color='primary'>
                            <IconButton onClick={() => setParticipantPanelOpen(true)} style={{ color: "white" }}>
                                <PeopleIcon />
                            </IconButton>
                        </Badge>

                        {/* Phase 5: Workspace Button */}
                        <Tooltip title="Meeting Workspace (Notes, Agenda, Tasks, Resources)">
                            <IconButton onClick={() => setWorkspaceDrawerOpen(true)} style={{ color: "white" }}>
                                <AssignmentIcon />
                            </IconButton>
                        </Tooltip>

                        {/* Phase 7: Recording Control (Host Only) */}
                        {isHost && meetingSettings.allowRecording !== false && (
                            <Tooltip title={isRecording ? "Stop Recording" : isFinalizingRecording ? "Finalizing Recording..." : "Start Recording"}>
                                <span>
                                    <IconButton
                                        onClick={isRecording ? handleStopRecording : handleStartRecording}
                                        disabled={isFinalizingRecording}
                                        style={{ color: isRecording ? "red" : isFinalizingRecording ? "orange" : "white" }}
                                    >
                                        {isFinalizingRecording ? (
                                            <CircularProgress size={24} color="inherit" />
                                        ) : isRecording ? (
                                            <StopCircleIcon />
                                        ) : (
                                            <FiberManualRecordIcon />
                                        )}
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}

                        {isHost && (
                            <IconButton onClick={() => setSettingsDialogOpen(true)} style={{ color: "white" }}>
                                <SettingsIcon />
                            </IconButton>
                        )}
                    </div>

                    {/* Local User Video */}
                    <video className={styles.meetUserVideo} ref={localVideoref} autoPlay muted></video>

                    {/* Remote Conference Videos */}
                    <div className={styles.conferenceView}>
                        {videos.map((v) => (
                            <div key={v.socketId}>
                                <video
                                    data-socket={v.socketId}
                                    ref={ref => {
                                        if (ref && v.stream) {
                                            ref.srcObject = v.stream;
                                        }
                                    }}
                                    autoPlay
                                    playsInline
                                />
                            </div>
                        ))}
                    </div>

                    {/* Host Settings Dialog */}
                    <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="xs" fullWidth>
                        <DialogTitle>Meeting Settings</DialogTitle>
                        <DialogContent>
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
                                label="Allow In-Meeting Chat"
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
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={meetingSettings.allowRecording !== false}
                                        onChange={(e) => setMeetingSettings({ ...meetingSettings, allowRecording: e.target.checked })}
                                    />
                                }
                                label="Allow Meeting Recording"
                            />
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setSettingsDialogOpen(false)}>Cancel</Button>
                            <Button variant="contained" onClick={handleSaveSettings}>Save</Button>
                        </DialogActions>
                    </Dialog>

                    {/* Host End Meeting Confirmation Dialog */}
                    <Dialog open={endMeetingDialogOpen} onClose={() => setEndMeetingDialogOpen(false)}>
                        <DialogTitle>Leave or End Meeting?</DialogTitle>
                        <DialogContent>
                            <Typography variant="body1">
                                As host, you can leave the meeting or end it for all participants.
                            </Typography>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={leaveCall}>Just Leave</Button>
                            <Button variant="contained" color="error" onClick={handleEndMeetingForAll}>
                                End Meeting for All
                            </Button>
                        </DialogActions>
                    </Dialog>
                </div>
            )}
        </div>
    );
}