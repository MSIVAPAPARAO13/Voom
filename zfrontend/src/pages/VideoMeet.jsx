import React, { useEffect, useRef, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from "socket.io-client";
import {
    IconButton,
    TextField,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    Box,
    Chip,
    Drawer,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
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
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import CloseIcon from '@mui/icons-material/Close';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DeleteIcon from '@mui/icons-material/Delete';

import MeetingHeader from '../components/meeting/MeetingHeader';
import MeetingStage from '../components/meeting/MeetingStage';
import MeetingControls from '../components/meeting/MeetingControls';
import ChatPanel from '../components/meeting/ChatPanel';
import ParticipantsPanel from '../components/meeting/ParticipantsPanel';
import MeetingSettingsDialog from '../components/meeting/MeetingSettingsDialog';

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
    const cameraStreamRef = useRef(null);
    const screenStreamRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const speakingIntervalRef = useRef(null);

    // Media & UI States
    const [videoAvailable, setVideoAvailable] = useState(true);
    const [audioAvailable, setAudioAvailable] = useState(true);
    const [video, setVideo] = useState(true);
    const [audio, setAudio] = useState(true);
    const [screen, setScreen] = useState(false);
    const [screenAvailable, setScreenAvailable] = useState(false);
    const [videos, setVideos] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionState, setConnectionState] = useState("disconnected"); // "connecting" | "connected" | "reconnecting"
    const [viewMode, setViewMode] = useState("spotlight"); // "spotlight" | "grid"
    const [spotlightSocketId, setSpotlightSocketId] = useState(null);
    const [presenterSocketId, setPresenterSocketId] = useState(null);
    const [presenterName, setPresenterName] = useState("");
    const [activeSpeakerSocketId, setActiveSpeakerSocketId] = useState(null);

    // Meeting Engine 3.0: Reactions, Hand Raising & Security States
    const [isHandRaised, setIsHandRaised] = useState(false);
    const [raisedHands, setRaisedHands] = useState([]);
    const [activeReactions, setActiveReactions] = useState({});
    const [isMeetingLocked, setIsMeetingLocked] = useState(false);
    const [infoDialogOpen, setInfoDialogOpen] = useState(false);

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
                } else if (userData && data.createdBy) {
                    const hostId = data.createdBy._id || data.createdBy.id || data.createdBy;
                    const hostUsername = data.createdBy.username || data.user_id;
                    if (
                        (hostId && String(hostId) === String(userData.id || userData._id)) ||
                        (hostUsername && hostUsername === userData.username)
                    ) {
                        setIsHost(true);
                    }
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
    }, [meetingCode, userData]);

    useEffect(() => {
        if (userData && meetingDetails && !isHost) {
            const hostId = meetingDetails.createdBy?._id || meetingDetails.createdBy?.id || meetingDetails.createdBy;
            const hostUsername = meetingDetails.createdBy?.username || meetingDetails.user_id;
            if (
                (hostId && String(hostId) === String(userData.id || userData._id)) ||
                (hostUsername && hostUsername === userData.username) ||
                meetingDetails.isHost
            ) {
                setIsHost(true);
            }
        }
    }, [userData, meetingDetails, isHost]);

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

    const setupAudioAnalyser = (stream) => {
        try {
            const tracks = stream.getAudioTracks();
            if (tracks.length === 0) return;
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;

            if (audioContextRef.current) {
                audioContextRef.current.close().catch(() => {});
            }

            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            const buffer = new Uint8Array(analyser.frequencyBinCount);
            let wasSpeaking = false;

            if (speakingIntervalRef.current) clearInterval(speakingIntervalRef.current);
            speakingIntervalRef.current = setInterval(() => {
                if (!audio || !socketRef.current) return;
                analyser.getByteFrequencyData(buffer);
                let sum = 0;
                for (let i = 0; i < buffer.length; i++) sum += buffer[i];
                const avg = sum / buffer.length;
                const isSpeakingNow = avg > 25;

                if (isSpeakingNow !== wasSpeaking) {
                    wasSpeaking = isSpeakingNow;
                    socketRef.current.emit("meeting:active-speaker", { meetingCode, isSpeaking: isSpeakingNow });
                    setActiveSpeakerSocketId(isSpeakingNow ? (socketIdRef.current || "self") : null);
                }
            }, 300);
        } catch (e) {
            console.log("Audio analyzer init skipped:", e.message);
        }
    };

    const getDislayMedia = async () => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                try {
                    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                    getDislayMediaSuccess(stream);
                } catch (e) {
                    console.log("getDisplayMedia cancelled or failed:", e);
                    setScreen(false);
                }
            }
        }
    };

    const getDislayMediaSuccess = (stream) => {
        screenStreamRef.current = stream;
        window.localStream = stream;
        if (localVideoref.current) {
            localVideoref.current.srcObject = stream;
        }

        if (realtimeProviderRef.current) {
            realtimeProviderRef.current.replaceLocalStream(stream);
        }

        if (socketRef.current) {
            socketRef.current.emit("meeting:start-screen-share", { meetingCode });
        }

        // Native browser stop sharing button
        stream.getVideoTracks()[0].onended = () => {
            stopScreenSharing();
        };
    };

    const stopScreenSharing = () => {
        setScreen(false);
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
        }

        if (cameraStreamRef.current && localVideoref.current) {
            window.localStream = cameraStreamRef.current;
            localVideoref.current.srcObject = cameraStreamRef.current;
            if (realtimeProviderRef.current) {
                realtimeProviderRef.current.replaceLocalStream(cameraStreamRef.current);
            }
        } else {
            getUserMedia();
        }

        if (socketRef.current) {
            socketRef.current.emit("meeting:stop-screen-share", { meetingCode });
        }
    };

    const getUserMediaSuccess = (stream) => {
        cameraStreamRef.current = stream;
        window.localStream = stream;
        if (localVideoref.current) {
            localVideoref.current.srcObject = stream;
        }

        if (realtimeProviderRef.current) {
            realtimeProviderRef.current.replaceLocalStream(stream);
        }

        setupAudioAnalyser(stream);

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);

            try {
                let tracks = localVideoref.current?.srcObject?.getTracks();
                if (tracks) tracks.forEach(track => track.stop());
            } catch (e) { }

            let blackStream = black();
            window.localStream = new MediaStream([blackStream]);
            if (localVideoref.current) localVideoref.current.srcObject = window.localStream;

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
                let tracks = localVideoref.current?.srcObject?.getTracks();
                if (tracks) tracks.forEach(track => track.stop());
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
        if (!screen) {
            if (!isHost && meetingSettings.allowScreenShare === false) {
                alert("Screen sharing has been disabled by the host.");
                return;
            }
            setScreen(true);
        } else {
            stopScreenSharing();
        }
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
            setIsConnected(true);
            socketIdRef.current = socketRef.current.id;

            // Send join-call with user identity metadata
            socketRef.current.emit('join-call', window.location.href, {
                username: username || "Guest",
                userId: userData?.id || null,
                isHost: isHost,
                isMuted: !audio,
                isVideoOff: !video
            });
        });

        socketRef.current.on('disconnect', () => {
            setIsConnected(false);
        });

        socketRef.current.on('connect_error', () => {
            setIsConnected(false);
        });

        socketRef.current.on('reconnect', () => {
            setIsConnected(true);
            socketIdRef.current = socketRef.current.id;
            socketRef.current.emit('join-call', window.location.href, {
                username: username || "Guest",
                userId: userData?.id || null,
                isHost: isHost,
                isMuted: !audio,
                isVideoOff: !video
            });
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

            // Screen share listeners
            socketRef.current.on('meeting:screen-share-started', (data) => {
                setPresenterSocketId(data.presenterSocketId);
                setPresenterName(data.presenterName || "Participant");
            });

            socketRef.current.on('meeting:screen-share-stopped', () => {
                setPresenterSocketId(null);
                setPresenterName("");
            });

            socketRef.current.on('meeting:screen-share-conflict', (data) => {
                alert(data.message || "Someone is already sharing their screen.");
            });

            // Active speaker listener
            socketRef.current.on('meeting:active-speaker-changed', (data) => {
                setActiveSpeakerSocketId(data.socketId);
            });

            // Host moderation: disable video
            socketRef.current.on('meeting:host-disabled-video', () => {
                setVideo(false);
                if (localVideoref.current && localVideoref.current.srcObject) {
                    localVideoref.current.srcObject.getVideoTracks().forEach(t => t.enabled = false);
                }
            });

            // Reactions listener
            socketRef.current.on('meeting:reaction-received', (data) => {
                const targetKey = data.senderSocketId === socketIdRef.current ? 'self' : data.senderSocketId;
                setActiveReactions(prev => ({ ...prev, [targetKey]: data.emoji }));
                setTimeout(() => {
                    setActiveReactions(prev => {
                        const copy = { ...prev };
                        delete copy[targetKey];
                        return copy;
                    });
                }, 3500);
            });

            // Hand raising listeners
            socketRef.current.on('meeting:hand-raised', (data) => {
                setRaisedHands(prev => prev.includes(data.socketId) ? prev : [...prev, data.socketId]);
            });

            socketRef.current.on('meeting:hand-lowered', (data) => {
                setRaisedHands(prev => prev.filter(id => id !== data.socketId));
                if (data.socketId === socketIdRef.current) {
                    setIsHandRaised(false);
                }
            });

            // Meeting Lock listeners
            socketRef.current.on('meeting:lock-status', (data) => {
                setIsMeetingLocked(data.isLocked);
            });

            socketRef.current.on('meeting:locked', (data) => {
                alert(data?.message || "This meeting has been locked by the host.");
                leaveCall();
            });
    };

    const handleSendReaction = (emoji) => {
        if (socketRef.current) {
            socketRef.current.emit("meeting:reaction", { meetingCode, emoji });
        }
        setActiveReactions(prev => ({ ...prev, self: emoji }));
        setTimeout(() => {
            setActiveReactions(prev => {
                const copy = { ...prev };
                delete copy.self;
                return copy;
            });
        }, 3500);
    };

    const handleToggleRaiseHand = () => {
        const next = !isHandRaised;
        setIsHandRaised(next);
        if (socketRef.current) {
            if (next) {
                socketRef.current.emit("meeting:raise-hand", { meetingCode });
            } else {
                socketRef.current.emit("meeting:lower-hand", { meetingCode });
            }
        }
    };

    const handleToggleMeetingLock = () => {
        const next = !isMeetingLocked;
        setIsMeetingLocked(next);
        if (socketRef.current) {
            socketRef.current.emit("meeting:toggle-lock", { meetingCode, isLocked: next });
        }
    };

    const handleToggleWaitingRoom = () => {
        const next = !meetingSettings.waitingRoomEnabled;
        setMeetingSettings(prev => ({ ...prev, waitingRoomEnabled: next }));
        if (socketRef.current) {
            socketRef.current.emit("meeting:update-settings", { meetingCode, settings: { ...meetingSettings, waitingRoomEnabled: next } });
        }
    };

    const handleToggleAllowChat = () => {
        const next = !meetingSettings.allowChat;
        setMeetingSettings(prev => ({ ...prev, allowChat: next }));
        if (socketRef.current) {
            socketRef.current.emit("meeting:update-settings", { meetingCode, settings: { ...meetingSettings, allowChat: next } });
        }
    };

    const handleToggleAllowScreenShare = () => {
        const next = !meetingSettings.allowScreenShare;
        setMeetingSettings(prev => ({ ...prev, allowScreenShare: next }));
        if (socketRef.current) {
            socketRef.current.emit("meeting:update-settings", { meetingCode, settings: { ...meetingSettings, allowScreenShare: next } });
        }
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

    const handleDisableParticipantVideo = (targetSocketId) => {
        if (socketRef.current) {
            socketRef.current.emit('meeting:disable-participant-video', {
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
                <Box sx={{
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    minHeight: '100vh', 
                    background: 'linear-gradient(135deg, #2c3e50 0%, #1a252f 100%)',
                    color: 'white',
                    p: 4
                }}>
                    <Box sx={{ textAlign: 'center', mb: 4, maxWidth: 600 }}>
                        <Typography variant="h3" fontWeight="bold" sx={{ mb: 1, color: '#FF9839' }}>
                            {meetingDetails?.title || "Ready to join?"}
                        </Typography>
                        {meetingDetails?.description ? (
                            <Typography variant="subtitle1" color="rgba(255,255,255,0.7)">
                                {meetingDetails.description}
                            </Typography>
                        ) : (
                            <Typography variant="subtitle1" color="rgba(255,255,255,0.7)">
                                Check your audio and video before joining the meeting.
                            </Typography>
                        )}
                    </Box>

                    <Box sx={{ 
                        width: '100%', 
                        maxWidth: 720, 
                        display: 'flex', 
                        flexDirection: { xs: 'column', md: 'row' }, 
                        gap: 4, 
                        alignItems: 'center',
                        bgcolor: 'rgba(255,255,255,0.05)',
                        p: 4,
                        borderRadius: 4,
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                    }}>
                        {/* Video Preview */}
                        <Box sx={{ flex: 1, width: '100%' }}>
                            <Box sx={{ 
                                width: '100%', 
                                aspectRatio: '16/9',
                                borderRadius: 3, 
                                overflow: 'hidden', 
                                border: '2px solid rgba(255,255,255,0.1)',
                                bgcolor: 'black',
                                position: 'relative'
                            }}>
                                <video ref={localVideoref} autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}></video>
                                
                                {/* Overlay Controls */}
                                <Box sx={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 2 }}>
                                    <IconButton 
                                        onClick={handleAudio} 
                                        sx={{ bgcolor: audio ? 'rgba(255,255,255,0.2)' : '#f44336', color: 'white', '&:hover': { bgcolor: audio ? 'rgba(255,255,255,0.3)' : '#d32f2f' } }}
                                    >
                                        {audio ? <MicIcon /> : <MicOffIcon />}
                                    </IconButton>
                                    <IconButton 
                                        onClick={handleVideo} 
                                        sx={{ bgcolor: video ? 'rgba(255,255,255,0.2)' : '#f44336', color: 'white', '&:hover': { bgcolor: video ? 'rgba(255,255,255,0.3)' : '#d32f2f' } }}
                                    >
                                        {video ? <VideocamIcon /> : <VideocamOffIcon />}
                                    </IconButton>
                                </Box>
                            </Box>
                        </Box>

                        {/* Join Form */}
                        <Box sx={{ width: { xs: '100%', md: 300 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <TextField
                                label="Your Name"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                variant="outlined"
                                fullWidth
                                sx={{ 
                                    '& .MuiOutlinedInput-root': {
                                        color: 'white',
                                        '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                                        '&:hover fieldset': { borderColor: 'white' },
                                        '&.Mui-focused fieldset': { borderColor: '#FF9839' },
                                    },
                                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                                    '& .MuiInputLabel-root.Mui-focused': { color: '#FF9839' }
                                }}
                            />
                            <Button 
                                variant="contained" 
                                size="large" 
                                onClick={connect}
                                fullWidth
                                sx={{ 
                                    bgcolor: '#FF9839', 
                                    color: 'white', 
                                    py: 1.5, 
                                    fontSize: '1.1rem',
                                    fontWeight: 'bold',
                                    '&:hover': { bgcolor: '#e68933' } 
                                }}
                            >
                                Join Meeting
                            </Button>
                        </Box>
                    </Box>
                </Box>
            ) : (
                <div className={styles.meetVideoContainer}>
                    {/* 1. Top Navigation & Meeting Header */}
                    <MeetingHeader
                        meetingTitle={meetingDetails?.title}
                        meetingCode={meetingCode}
                        participantCount={participantsList.length > 0 ? participantsList.length : (videos.length + 1)}
                        isConnected={isConnected}
                        isHost={isHost}
                        viewMode={viewMode}
                        onToggleViewMode={() => setViewMode(prev => prev === "spotlight" ? "grid" : "spotlight")}
                        onOpenSettings={() => setSettingsDialogOpen(true)}
                        onOpenWorkspace={() => setWorkspaceDrawerOpen(true)}
                        onOpenParticipants={() => setParticipantPanelOpen(true)}
                    />

                    {/* Phase 7: Recording Banner Indicator (Visible to all participants) */}
                    {(isRecording || isFinalizingRecording) && (
                        <Box sx={{
                            position: 'absolute',
                            top: 72,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 1300,
                            backgroundColor: isFinalizingRecording ? 'rgba(237, 108, 2, 0.95)' : 'rgba(211, 47, 47, 0.95)',
                            color: 'white',
                            px: 2,
                            py: 0.75,
                            borderRadius: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.2,
                            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                            backdropFilter: 'blur(8px)'
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
                            <Typography variant="body2" sx={{ fontWeight: 600, letterSpacing: 0.5, fontSize: '0.82rem' }}>
                                {isFinalizingRecording ? "Finalizing recording..." : `REC ${recordingTimer}`}
                            </Typography>
                        </Box>
                    )}

                    {/* Phase 8: Transcription Status Banner */}
                    {transcriptionStatus && (transcriptionStatus.status === 'queued' || transcriptionStatus.status === 'processing' || transcriptionStatus.status === 'completed') && (
                        <Box sx={{
                            position: 'absolute',
                            top: (isRecording || isFinalizingRecording) ? 120 : 72,
                            right: 20,
                            zIndex: 1300,
                            backgroundColor: transcriptionStatus.status === 'completed'
                                ? 'rgba(46, 125, 50, 0.95)'
                                : 'rgba(25, 118, 210, 0.95)',
                            color: 'white',
                            px: 2,
                            py: 0.75,
                            borderRadius: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                            backdropFilter: 'blur(8px)'
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

                    {/* 2. Main Meeting Body - Flex row containing Stage and Side Drawers */}
                    <div className={styles.meetingBody}>
                        {/* Dynamic Adaptive Video Stage */}
                        <MeetingStage
                            localVideoref={localVideoref}
                            video={video}
                            audio={audio}
                            screen={screen}
                            onStopScreenShare={handleScreen}
                            username={username || userData?.name || "You"}
                            isHost={isHost}
                            videos={videos}
                            participantsList={participantsList}
                            viewMode={viewMode}
                            spotlightSocketId={spotlightSocketId}
                            onSetSpotlightSocketId={setSpotlightSocketId}
                            presenterSocketId={presenterSocketId}
                            presenterName={presenterName}
                            activeSpeakerSocketId={activeSpeakerSocketId}
                            activeReactions={activeReactions}
                            raisedHands={raisedHands}
                            isHandRaised={isHandRaised}
                        />

                        {/* In-Meeting Chat Drawer (Slide-out) */}
                        <ChatPanel
                            open={showModal}
                            onClose={() => setModal(false)}
                            messages={messages}
                            message={message}
                            onMessageChange={handleTypingChange}
                            onSendMessage={sendMessage}
                            allowChat={meetingSettings.allowChat}
                            isHost={isHost}
                            userData={userData}
                            editingMessageId={editingMessageId}
                            editingContent={editingContent}
                            onSetEditingContent={setEditingContent}
                            onStartEditMessage={handleEditMessage}
                            onCancelEditMessage={() => setEditingMessageId(null)}
                            onSaveEditedMessage={handleSaveEditedMessage}
                            onDeleteMessage={handleDeleteMessage}
                            onReactMessage={handleReactMessage}
                            typingUsers={typingUsers}
                        />

                        {/* Participant & Moderation Panel Drawer (Slide-out) */}
                        <ParticipantsPanel
                            open={participantPanelOpen}
                            onClose={() => setParticipantPanelOpen(false)}
                            participantsList={participantsList.length > 0 ? participantsList : [{ socketId: socketIdRef.current || 'self', username: username || 'You', isHost, isMuted: !audio, isVideoOff: !video }]}
                            waitingParticipants={waitingParticipants}
                            localSocketId={socketIdRef.current}
                            username={username || userData?.name || "You"}
                            isHost={isHost}
                            onApproveWaiting={handleApproveWaiting}
                            onRejectWaiting={handleRejectWaiting}
                            onMuteParticipant={handleMuteParticipant}
                            onRemoveParticipant={handleRemoveParticipant}
                            onDisableVideo={handleDisableParticipantVideo}
                        />

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
                    </div>

                    {/* 3. Floating Bottom Controls Dock */}
                    <MeetingControls
                        video={video}
                        audio={audio}
                        screen={screen}
                        screenAvailable={screenAvailable}
                        allowScreenShare={meetingSettings.allowScreenShare}
                        isHost={isHost}
                        showChat={showModal}
                        unreadMessages={newMessages}
                        showParticipants={participantPanelOpen}
                        participantCount={participantsList.length > 0 ? participantsList.length : (videos.length + 1)}
                        showWorkspace={workspaceDrawerOpen}
                        isRecording={isRecording}
                        isFinalizingRecording={isFinalizingRecording}
                        allowRecording={meetingSettings.allowRecording}
                        isHandRaised={isHandRaised}
                        isMeetingLocked={isMeetingLocked}
                        waitingRoomEnabled={meetingSettings.waitingRoomEnabled}
                        allowChat={meetingSettings.allowChat}
                        onToggleAudio={handleAudio}
                        onToggleVideo={handleVideo}
                        onToggleScreen={handleScreen}
                        onToggleChat={() => { setModal(!showModal); setNewMessages(0); }}
                        onToggleParticipants={() => setParticipantPanelOpen(!participantPanelOpen)}
                        onToggleWorkspace={() => setWorkspaceDrawerOpen(!workspaceDrawerOpen)}
                        onStartRecording={handleStartRecording}
                        onStopRecording={handleStopRecording}
                        onOpenSettings={() => setSettingsDialogOpen(true)}
                        onSendReaction={handleSendReaction}
                        onToggleRaiseHand={handleToggleRaiseHand}
                        onToggleMeetingLock={handleToggleMeetingLock}
                        onToggleWaitingRoom={handleToggleWaitingRoom}
                        onToggleAllowChat={handleToggleAllowChat}
                        onToggleAllowScreenShare={handleToggleAllowScreenShare}
                        onOpenInfo={() => setInfoDialogOpen(true)}
                        onEndCall={handleEndCall}
                    />

                    {/* Meeting Info Dialog */}
                    <Dialog
                        open={infoDialogOpen}
                        onClose={() => setInfoDialogOpen(false)}
                        slotProps={{
                            paper: {
                                sx: {
                                    bgcolor: '#0f172a',
                                    color: '#f8fafc',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '16px',
                                    p: 1,
                                    minWidth: 340
                                }
                            }
                        }}
                    >
                        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Meeting Information</span>
                            <IconButton size="small" onClick={() => setInfoDialogOpen(false)} sx={{ color: '#94a3b8' }}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </DialogTitle>
                        <DialogContent>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                                <Typography variant="caption" sx={{ color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Meeting Title</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 600, color: '#f8fafc' }}>{meetingDetails?.title || "Live Meeting"}</Typography>
                                
                                <Typography variant="caption" sx={{ color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, mt: 1 }}>Meeting Code</Typography>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#FF9839', letterSpacing: 1 }}>{meetingCode}</Typography>
                                
                                <Typography variant="caption" sx={{ color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, mt: 1 }}>Direct Join URL</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <Typography variant="body2" sx={{ color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{window.location.href}</Typography>
                                    <Button size="small" variant="contained" onClick={() => { navigator.clipboard.writeText(window.location.href); alert("Meeting link copied!"); }} sx={{ textTransform: 'none', bgcolor: '#4f46e5' }}>Copy</Button>
                                </Box>
                                
                                <Typography variant="caption" sx={{ color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, mt: 1 }}>Security Status</Typography>
                                <Typography variant="body2" sx={{ color: isMeetingLocked ? '#f87171' : '#34d399', fontWeight: 600 }}>
                                    {isMeetingLocked ? "🔒 Meeting is Locked (No new joins)" : "🔓 Meeting is Open"}
                                </Typography>
                            </Box>
                        </DialogContent>
                    </Dialog>

                    {/* 4. Host Settings Dialog */}
                    <MeetingSettingsDialog
                        open={settingsDialogOpen}
                        onClose={() => setSettingsDialogOpen(false)}
                        meetingSettings={meetingSettings}
                        onSettingsChange={setMeetingSettings}
                        onSaveSettings={handleSaveSettings}
                    />

                    {/* 5. Host End Meeting Confirmation Dialog */}
                    <Dialog
                        open={endMeetingDialogOpen}
                        onClose={() => setEndMeetingDialogOpen(false)}
                        slotProps={{
                            paper: {
                                sx: {
                                    bgcolor: '#0f172a',
                                    color: '#f8fafc',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '16px',
                                    p: 1
                                }
                            }
                        }}
                    >
                        <DialogTitle sx={{ fontWeight: 700 }}>Leave or End Meeting?</DialogTitle>
                        <DialogContent>
                            <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                                As host, you can leave the meeting or end it for all participants.
                            </Typography>
                        </DialogContent>
                        <DialogActions sx={{ p: 2 }}>
                            <Button onClick={leaveCall} sx={{ color: '#94a3b8' }}>Just Leave</Button>
                            <Button variant="contained" color="error" onClick={handleEndMeetingForAll} sx={{ fontWeight: 600 }}>
                                End Meeting for All
                            </Button>
                        </DialogActions>
                    </Dialog>
                </div>
            )}
        </div>
    );
}