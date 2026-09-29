import { Router } from "express";
import {
    createMeeting,
    getMeetingDetails,
    updateMeetingSettings,
    endMeeting,
    getMeetingWorkspace,
    updateMeetingNotes,
    addAgendaItem,
    updateAgendaItem,
    deleteAgendaItem,
    createTask,
    updateTask,
    deleteTask,
    addResource,
    deleteResource,
    getMeetingMessages,
    sendMeetingMessage,
    editMeetingMessage,
    deleteMeetingMessage,
    reactToMeetingMessage,
    startMeetingRecording,
    stopMeetingRecording,
    getMeetingRecordings,
    getMeetingRecordingDetails,
    streamMeetingRecordingMedia,
    deleteMeetingRecording,
    startRecordingTranscription,
    getRecordingTranscriptionStatus,
    getRecordingTranscript,
    searchRecordingTranscript,
    startMeetingIntelligence,
    getMeetingIntelligence,
    generateRealtimeToken
} from "../controllers/meeting.controller.js";
import { authenticate, optionalAuthenticate } from "../middleware/auth.middleware.js";
import { resolveTenant } from "../middleware/tenant.middleware.js";

const router = Router();

// Create new meeting (tenant-scoped)
router.route("/").post(authenticate, resolveTenant, createMeeting);

// Get meeting details (guest-safe or member-verified)
router.route("/:meetingCode").get(optionalAuthenticate, getMeetingDetails);

// Update meeting settings (host/admin authorized)
router.route("/:meetingCode/settings").patch(authenticate, resolveTenant, updateMeetingSettings);

// End meeting (host/admin authorized)
router.route("/:meetingCode/end").post(authenticate, resolveTenant, endMeeting);

// ==========================================
// PHASE 5: WORKSPACE COLLABORATION ROUTES
// ==========================================

// Workspace overview (read-only for guests, full read for members)
router.route("/:meetingCode/workspace").get(optionalAuthenticate, getMeetingWorkspace);

// Notes (member authorized)
router.route("/:meetingCode/notes").patch(authenticate, resolveTenant, updateMeetingNotes);

// Agenda
router.route("/:meetingCode/agenda").post(authenticate, resolveTenant, addAgendaItem);
router.route("/:meetingCode/agenda/:itemId")
    .patch(authenticate, resolveTenant, updateAgendaItem)
    .delete(authenticate, resolveTenant, deleteAgendaItem);

// Tasks / Action Items
router.route("/:meetingCode/tasks").post(authenticate, resolveTenant, createTask);
router.route("/:meetingCode/tasks/:taskId")
    .patch(authenticate, resolveTenant, updateTask)
    .delete(authenticate, resolveTenant, deleteTask);

// Resources
router.route("/:meetingCode/resources").post(authenticate, resolveTenant, addResource);
router.route("/:meetingCode/resources/:resourceId").delete(authenticate, resolveTenant, deleteResource);

// ==========================================
// PHASE 6: PERSISTENT MEETING CHAT ROUTES
// ==========================================

// Chat message retrieval (read-only for guests, full read for members) and sending (members only)
router.route("/:meetingCode/messages")
    .get(optionalAuthenticate, getMeetingMessages)
    .post(authenticate, resolveTenant, sendMeetingMessage);

// Chat message edit & delete
router.route("/:meetingCode/messages/:messageId")
    .patch(authenticate, resolveTenant, editMeetingMessage)
    .delete(authenticate, resolveTenant, deleteMeetingMessage);

// Chat message reaction
router.route("/:meetingCode/messages/:messageId/reactions")
    .post(authenticate, resolveTenant, reactToMeetingMessage);

// ==========================================
// PHASE 7: MEETING RECORDING & MEDIA ROUTES
// ==========================================

// Start recording (host/admin authorized)
router.route("/:meetingCode/recordings/start")
    .post(authenticate, resolveTenant, startMeetingRecording);

// Stop recording & upload media (host/admin authorized)
router.route("/:meetingCode/recordings/:recordingId/stop")
    .post(authenticate, resolveTenant, stopMeetingRecording);

// List all recordings for meeting (authenticated members only)
router.route("/:meetingCode/recordings")
    .get(authenticate, resolveTenant, getMeetingRecordings);

// Recording metadata details
router.route("/:meetingCode/recordings/:recordingId")
    .get(authenticate, resolveTenant, getMeetingRecordingDetails)
    .delete(authenticate, resolveTenant, deleteMeetingRecording);

// Media streaming & download (HTTP 206 Partial Content / 200 OK)
router.route("/:meetingCode/recordings/:recordingId/media")
    .get(authenticate, resolveTenant, streamMeetingRecordingMedia);

// ==========================================
// PHASE 8: MEETING TRANSCRIPTION & SEARCH ROUTES
// ==========================================

// Start transcription (host/admin authorized) & get status (members authorized)
router.route("/:meetingCode/recordings/:recordingId/transcription")
    .post(authenticate, resolveTenant, startRecordingTranscription)
    .get(authenticate, resolveTenant, getRecordingTranscriptionStatus);

// Get completed transcript (members authorized)
router.route("/:meetingCode/recordings/:recordingId/transcript")
    .get(authenticate, resolveTenant, getRecordingTranscript);

// Case-insensitive search on transcript segments (members authorized)
router.route("/:meetingCode/recordings/:recordingId/transcript/search")
    .get(authenticate, resolveTenant, searchRecordingTranscript);

// ==========================================
// PHASE 9: MEETING AI INTELLIGENCE ROUTES
// ==========================================

// Start AI intelligence generation (host/admin authorized) & get intelligence (members authorized)
router.route("/:meetingCode/recordings/:recordingId/intelligence")
    .post(authenticate, resolveTenant, startMeetingIntelligence)
    .get(authenticate, resolveTenant, getMeetingIntelligence);

// ==========================================
// PHASE 11: LIVEKIT REALTIME TOKEN ROUTE
// ==========================================

// Generate realtime token (guest-safe or member-verified)
router.route("/:meetingCode/realtime-token").post(optionalAuthenticate, generateRealtimeToken);

export default router;
