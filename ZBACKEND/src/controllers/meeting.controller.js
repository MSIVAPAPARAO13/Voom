import logger from "../utils/logger.js";
import httpStatus from "http-status";
import crypto from "crypto";
import { Meeting } from "../models/meeting.model.js";
import { Membership } from "../models/membership.model.js";
import { Message } from "../models/message.model.js";
import { storageService } from "../services/storage.service.js";
import { Transcript } from "../models/transcript.model.js";
import { transcriptionService } from "../services/transcription.service.js";
import { broadcastTranscriptionEvent, broadcastAIEvent } from "../sockets/socketManager.js";
import { MeetingIntelligence } from "../models/meetingIntelligence.model.js";
import { meetingAIService } from "../services/meetingAI.service.js";
import { indexTranscript, deleteTranscriptKnowledge } from "../services/knowledgeIndex.service.js";
import { livekitService } from "../services/livekit.service.js";
import { transcriptionQueue, intelligenceQueue } from "../services/queue.service.js";
import { entitlementService } from "../services/billing/entitlement.service.js";
import { usageService } from "../services/billing/usage.service.js";

/**
 * Helper to check if a user is authorized as meeting host or org admin/owner.
 */
export const isUserMeetingHostOrAdmin = async (userId, meeting) => {
    if (!userId || !meeting) return false;

    // Direct host check
    if (meeting.createdBy && meeting.createdBy.toString() === userId.toString()) {
        return true;
    }

    // Organization admin or owner check
    if (meeting.organization) {
        const membership = await Membership.findOne({
            user: userId,
            organization: meeting.organization,
            status: "active"
        });
        if (membership && (membership.role === "owner" || membership.role === "admin")) {
            return true;
        }
    }

    return false;
};

/**
 * Helper to check if a user is an active member of the meeting's organization.
 */
export const isUserMeetingMember = async (userId, meeting) => {
    if (!userId || !meeting) return false;

    // Meeting creator is always considered a member
    if (meeting.createdBy && meeting.createdBy.toString() === userId.toString()) {
        return true;
    }

    if (meeting.organization) {
        const membership = await Membership.findOne({
            user: userId,
            organization: meeting.organization,
            status: "active"
        });
        return !!membership;
    }

    return true;
};

/**
 * Create a new meeting with metadata and settings.
 */
export const createMeeting = async (req, res) => {
    try {
        const { title, description, status, settings, meetingCode: customCode } = req.body;

        if (req.organization) {
            const entitlementCheck = await entitlementService.canUseFeature(req.organization._id, "meetings");
            if (!entitlementCheck.allowed) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Feature not available on the current plan",
                    code: "FEATURE_NOT_ENTITLED"
                });
            }
        }

        const meetingCode = (customCode && customCode.trim()) || crypto.randomBytes(4).toString("hex");

        const defaultSettings = {
            allowGuestAccess: true,
            waitingRoomEnabled: false,
            allowScreenShare: true,
            allowChat: true,
            allowParticipantUnmute: true
        };

        const mergedSettings = { ...defaultSettings, ...(settings || {}) };

        const newMeeting = new Meeting({
            organization: req.organization ? req.organization._id : undefined,
            createdBy: req.user.id,
            user_id: req.user.username,
            meetingCode,
            title: title ? title.trim() : "Untitled Meeting",
            description: description ? description.trim() : "",
            status: status === "scheduled" ? "scheduled" : "live",
            settings: mergedSettings,
            startedAt: new Date(),
            workspace: {
                notes: { content: "", version: 1 },
                agenda: [],
                tasks: [],
                resources: []
            }
        });

        await newMeeting.save();

        return res.status(httpStatus.CREATED).json({
            message: "Meeting created successfully",
            meeting: {
                id: newMeeting._id,
                meetingCode: newMeeting.meetingCode,
                title: newMeeting.title,
                description: newMeeting.description,
                status: newMeeting.status,
                settings: newMeeting.settings,
                startedAt: newMeeting.startedAt,
                organization: newMeeting.organization,
                createdBy: newMeeting.createdBy
            }
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to create meeting: `
        });
    }
};

/**
 * Get meeting details by meetingCode.
 * Accessible to authenticated members and guests (if allowGuestAccess=true).
 */
export const getMeetingDetails = async (req, res) => {
    try {
        const { meetingCode } = req.params;

        const meeting = await Meeting.findOne({ meetingCode })
            .populate("createdBy", "name username")
            .populate("organization", "name slug");

        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        const isHost = req.user ? await isUserMeetingHostOrAdmin(req.user.id, meeting) : false;

        // Guest access restriction check
        if (!isHost) {
            const guestAccessAllowed = meeting.settings ? meeting.settings.allowGuestAccess !== false : true;

            if (!req.user && !guestAccessAllowed) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Guest access is disabled for this meeting. Please log in."
                });
            }

            // If user is authenticated, check organization membership if meeting is org-scoped
            if (req.user && meeting.organization && !guestAccessAllowed) {
                const membership = await Membership.findOne({
                    user: req.user.id,
                    organization: meeting.organization._id,
                    status: "active"
                });
                if (!membership) {
                    return res.status(httpStatus.FORBIDDEN).json({
                        message: "This meeting is private to organization members."
                    });
                }
            }
        }

        return res.status(httpStatus.OK).json({
            meetingCode: meeting.meetingCode,
            title: meeting.title || "Untitled Meeting",
            description: meeting.description || "",
            status: meeting.status || "live",
            settings: meeting.settings || {
                allowGuestAccess: true,
                waitingRoomEnabled: false,
                allowScreenShare: true,
                allowChat: true,
                allowParticipantUnmute: true
            },
            startedAt: meeting.startedAt || meeting.date,
            endedAt: meeting.endedAt,
            host: meeting.createdBy ? {
                id: meeting.createdBy._id,
                name: meeting.createdBy.name,
                username: meeting.createdBy.username
            } : null,
            organization: meeting.organization ? {
                id: meeting.organization._id,
                name: meeting.organization.name,
                slug: meeting.organization.slug
            } : null,
            isHost
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to fetch meeting details: `
        });
    }
};

/**
 * Update meeting settings and metadata.
 * Only meeting host or organization admin/owner can update.
 */
export const updateMeetingSettings = async (req, res) => {
    try {
        const { meetingCode } = req.params;
        const { title, description, settings } = req.body;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        const isAuthorized = await isUserMeetingHostOrAdmin(req.user.id, meeting);
        if (!isAuthorized) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only the meeting host or organization admin can update meeting settings"
            });
        }

        if (title !== undefined) meeting.title = title.trim();
        if (description !== undefined) meeting.description = description.trim();

        if (settings && typeof settings === "object") {
            const currentSettings = meeting.settings || {};
            if (typeof settings.allowGuestAccess === "boolean") currentSettings.allowGuestAccess = settings.allowGuestAccess;
            if (typeof settings.waitingRoomEnabled === "boolean") currentSettings.waitingRoomEnabled = settings.waitingRoomEnabled;
            if (typeof settings.allowScreenShare === "boolean") currentSettings.allowScreenShare = settings.allowScreenShare;
            if (typeof settings.allowChat === "boolean") currentSettings.allowChat = settings.allowChat;
            if (typeof settings.allowParticipantUnmute === "boolean") currentSettings.allowParticipantUnmute = settings.allowParticipantUnmute;
            meeting.settings = currentSettings;
        }

        await meeting.save();

        return res.status(httpStatus.OK).json({
            message: "Meeting settings updated successfully",
            meeting: {
                meetingCode: meeting.meetingCode,
                title: meeting.title,
                description: meeting.description,
                status: meeting.status,
                settings: meeting.settings
            }
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to update meeting settings: `
        });
    }
};

/**
 * End a meeting.
 * Only meeting host or organization admin/owner can end.
 */
export const endMeeting = async (req, res) => {
    try {
        const { meetingCode } = req.params;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        const isAuthorized = await isUserMeetingHostOrAdmin(req.user.id, meeting);
        if (!isAuthorized) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only the meeting host or organization admin can end the meeting"
            });
        }

        if (meeting.status === "ended") {
            return res.status(httpStatus.BAD_REQUEST).json({ message: "Meeting has already ended" });
        }

        meeting.status = "ended";
        meeting.endedAt = new Date();

        // PHASE 7: Safely finalize any active recording sessions
        if (meeting.recordings && meeting.recordings.length > 0) {
            meeting.recordings.forEach(rec => {
                if (rec.status === "recording" || rec.status === "processing") {
                    rec.status = (rec.storageKey && rec.fileSize > 0) ? "ready" : "failed";
                    rec.endedAt = rec.endedAt || new Date();
                    if (!rec.duration && rec.startedAt) {
                        rec.duration = Math.max(1, Math.round((rec.endedAt.getTime() - new Date(rec.startedAt).getTime()) / 1000));
                    }
                }
            });
        }

        await meeting.save();

        return res.status(httpStatus.OK).json({
            message: "Meeting ended successfully",
            meetingCode: meeting.meetingCode,
            status: meeting.status,
            endedAt: meeting.endedAt
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to end meeting: `
        });
    }
};

// ==========================================
// PHASE 5: WORKSPACE COLLABORATION ENDPOINTS
// ==========================================

/**
 * Get meeting workspace (notes, agenda, tasks, resources).
 * Supports authenticated members and guests (read-only if guest).
 */
export const getMeetingWorkspace = async (req, res) => {
    try {
        const { meetingCode } = req.params;

        const meeting = await Meeting.findOne({ meetingCode })
            .populate("workspace.notes.updatedBy", "name username")
            .populate("workspace.agenda.createdBy", "name username")
            .populate("workspace.tasks.assignedTo", "name username")
            .populate("workspace.tasks.createdBy", "name username")
            .populate("workspace.resources.createdBy", "name username");

        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        // Access check
        if (req.user) {
            const isMember = await isUserMeetingMember(req.user.id, meeting);
            const guestAccessAllowed = meeting.settings ? meeting.settings.allowGuestAccess !== false : true;
            if (!isMember && !guestAccessAllowed) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "You do not have access to this meeting's workspace."
                });
            }
        } else {
            // Guest check
            const guestAccessAllowed = meeting.settings ? meeting.settings.allowGuestAccess !== false : true;
            if (!guestAccessAllowed) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Guest access is disabled for this meeting workspace."
                });
            }
        }

        // Return safe defaults if workspace not present on legacy records
        const defaultWorkspace = {
            notes: { content: "", updatedBy: null, updatedAt: null, version: 1 },
            agenda: [],
            tasks: [],
            resources: []
        };

        const workspace = meeting.workspace || defaultWorkspace;

        return res.status(httpStatus.OK).json({
            meetingCode: meeting.meetingCode,
            workspace: {
                notes: workspace.notes || defaultWorkspace.notes,
                agenda: workspace.agenda || [],
                tasks: workspace.tasks || [],
                resources: workspace.resources || []
            },
            isReadOnly: !req.user
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to fetch workspace: `
        });
    }
};

/**
 * Update meeting notes.
 * Authenticated organization members only.
 */
export const updateMeetingNotes = async (req, res) => {
    try {
        const { meetingCode } = req.params;
        const { content } = req.body;

        if (typeof content !== "string" || content.length > 50000) {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: "Notes content must be a string under 50,000 characters."
            });
        }

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        const isMember = await isUserMeetingMember(req.user.id, meeting);
        if (!isMember) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only organization members can update meeting notes."
            });
        }

        if (!meeting.workspace) {
            meeting.workspace = {};
        }
        if (!meeting.workspace.notes) {
            meeting.workspace.notes = { version: 1 };
        }

        meeting.workspace.notes.content = content;
        meeting.workspace.notes.updatedBy = req.user.id;
        meeting.workspace.notes.updatedAt = new Date();
        meeting.workspace.notes.version = (meeting.workspace.notes.version || 1) + 1;

        await meeting.save();

        return res.status(httpStatus.OK).json({
            message: "Notes updated successfully",
            notes: meeting.workspace.notes
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to update notes: `
        });
    }
};

/**
 * Add agenda item.
 * Authenticated organization members only.
 */
export const addAgendaItem = async (req, res) => {
    try {
        const { meetingCode } = req.params;
        const { title, description, order, status, duration } = req.body;

        if (!title || typeof title !== "string" || title.trim().length > 200) {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: "Agenda title is required and must be under 200 characters."
            });
        }

        if (description && (typeof description !== "string" || description.length > 1000)) {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: "Agenda description must be under 1,000 characters."
            });
        }

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        const isMember = await isUserMeetingMember(req.user.id, meeting);
        if (!isMember) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only organization members can add agenda items."
            });
        }

        if (!meeting.workspace) meeting.workspace = {};
        if (!meeting.workspace.agenda) meeting.workspace.agenda = [];

        const newItem = {
            title: title.trim(),
            description: description ? description.trim() : "",
            order: typeof order === "number" ? order : meeting.workspace.agenda.length + 1,
            status: ["pending", "active", "completed"].includes(status) ? status : "pending",
            duration: typeof duration === "number" ? duration : 0,
            createdBy: req.user.id,
            createdAt: new Date()
        };

        meeting.workspace.agenda.push(newItem);
        await meeting.save();

        const createdItem = meeting.workspace.agenda[meeting.workspace.agenda.length - 1];

        return res.status(httpStatus.CREATED).json({
            message: "Agenda item added successfully",
            item: createdItem
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to add agenda item: `
        });
    }
};

/**
 * Update agenda item status/details.
 * Authenticated organization members only.
 */
export const updateAgendaItem = async (req, res) => {
    try {
        const { meetingCode, itemId } = req.params;
        const { title, description, order, status, duration } = req.body;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        const isMember = await isUserMeetingMember(req.user.id, meeting);
        if (!isMember) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only organization members can update agenda items."
            });
        }

        const item = meeting.workspace?.agenda?.id(itemId);
        if (!item) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Agenda item not found" });
        }

        if (title !== undefined) item.title = title.trim();
        if (description !== undefined) item.description = description.trim();
        if (typeof order === "number") item.order = order;
        if (["pending", "active", "completed"].includes(status)) item.status = status;
        if (typeof duration === "number") item.duration = duration;

        await meeting.save();

        return res.status(httpStatus.OK).json({
            message: "Agenda item updated successfully",
            item
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to update agenda item: `
        });
    }
};

/**
 * Delete agenda item.
 * Host or Organization Admin/Owner only.
 */
export const deleteAgendaItem = async (req, res) => {
    try {
        const { meetingCode, itemId } = req.params;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        const isAuthorized = await isUserMeetingHostOrAdmin(req.user.id, meeting);
        if (!isAuthorized) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only the meeting host or organization admin can delete agenda items."
            });
        }

        const item = meeting.workspace?.agenda?.id(itemId);
        if (!item) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Agenda item not found" });
        }

        meeting.workspace.agenda.pull(itemId);
        await meeting.save();

        return res.status(httpStatus.OK).json({ message: "Agenda item deleted successfully" });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to delete agenda item: `
        });
    }
};

/**
 * Create action item / task.
 * Enforces task assignment security (assignee must belong to meeting's organization).
 */
export const createTask = async (req, res) => {
    try {
        const { meetingCode } = req.params;
        const { title, description, assignedTo, status, dueDate } = req.body;

        if (!title || typeof title !== "string" || title.trim().length > 200) {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: "Task title is required and must be under 200 characters."
            });
        }

        if (description && (typeof description !== "string" || description.length > 1000)) {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: "Task description must be under 1,000 characters."
            });
        }

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        const isMember = await isUserMeetingMember(req.user.id, meeting);
        if (!isMember) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only organization members can create tasks."
            });
        }

        // TASK ASSIGNMENT SECURITY:
        // A task may ONLY be assigned to an active member of the meeting's organization.
        if (assignedTo) {
            if (!meeting.organization) {
                return res.status(httpStatus.BAD_REQUEST).json({
                    message: "Tasks can only be assigned within an organization-scoped meeting."
                });
            }

            const assigneeMembership = await Membership.findOne({
                user: assignedTo,
                organization: meeting.organization,
                status: "active"
            });

            if (!assigneeMembership) {
                return res.status(httpStatus.BAD_REQUEST).json({
                    message: "Assigned user must be an active member of this organization."
                });
            }
        }

        if (!meeting.workspace) meeting.workspace = {};
        if (!meeting.workspace.tasks) meeting.workspace.tasks = [];

        const newTask = {
            title: title.trim(),
            description: description ? description.trim() : "",
            assignedTo: assignedTo || null,
            status: ["todo", "in_progress", "completed"].includes(status) ? status : "todo",
            dueDate: dueDate ? new Date(dueDate) : null,
            createdBy: req.user.id,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        meeting.workspace.tasks.push(newTask);
        await meeting.save();

        const createdTask = meeting.workspace.tasks[meeting.workspace.tasks.length - 1];

        return res.status(httpStatus.CREATED).json({
            message: "Task created successfully",
            task: createdTask
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to create task: `
        });
    }
};

/**
 * Update task status, assignee, or details.
 * Assigned member can update status; Host/Admin can update all fields.
 */
export const updateTask = async (req, res) => {
    try {
        const { meetingCode, taskId } = req.params;
        const { title, description, assignedTo, status, dueDate } = req.body;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        const task = meeting.workspace?.tasks?.id(taskId);
        if (!task) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Task not found" });
        }

        const isHost = await isUserMeetingHostOrAdmin(req.user.id, meeting);
        const isAssignee = task.assignedTo && task.assignedTo.toString() === req.user.id.toString();
        const isCreator = task.createdBy && task.createdBy.toString() === req.user.id.toString();

        if (!isHost && !isAssignee && !isCreator) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "You are not authorized to modify this task."
            });
        }

        // If assigning to a new user, validate membership
        if (assignedTo !== undefined && assignedTo !== task.assignedTo?.toString()) {
            if (!isHost) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Only the meeting host or admin can reassign tasks."
                });
            }
            if (assignedTo && meeting.organization) {
                const assigneeMembership = await Membership.findOne({
                    user: assignedTo,
                    organization: meeting.organization,
                    status: "active"
                });
                if (!assigneeMembership) {
                    return res.status(httpStatus.BAD_REQUEST).json({
                        message: "Assigned user must be an active member of this organization."
                    });
                }
            }
            task.assignedTo = assignedTo || null;
        }

        if (title !== undefined && (isHost || isCreator)) task.title = title.trim();
        if (description !== undefined && (isHost || isCreator)) task.description = description.trim();
        if (["todo", "in_progress", "completed"].includes(status)) task.status = status;
        if (dueDate !== undefined && (isHost || isCreator)) task.dueDate = dueDate ? new Date(dueDate) : null;
        task.updatedAt = new Date();

        await meeting.save();

        return res.status(httpStatus.OK).json({
            message: "Task updated successfully",
            task
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to update task: `
        });
    }
};

/**
 * Delete task.
 * Host, Admin, or Task Creator only.
 */
export const deleteTask = async (req, res) => {
    try {
        const { meetingCode, taskId } = req.params;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        const task = meeting.workspace?.tasks?.id(taskId);
        if (!task) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Task not found" });
        }

        const isHost = await isUserMeetingHostOrAdmin(req.user.id, meeting);
        const isCreator = task.createdBy && task.createdBy.toString() === req.user.id.toString();

        if (!isHost && !isCreator) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only the meeting host, admin, or task creator can delete tasks."
            });
        }

        meeting.workspace.tasks.pull(taskId);
        await meeting.save();

        return res.status(httpStatus.OK).json({ message: "Task deleted successfully" });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to delete task: `
        });
    }
};

/**
 * Add reference resource (URL).
 * Validates URL begins with http:// or https://.
 */
export const addResource = async (req, res) => {
    try {
        const { meetingCode } = req.params;
        const { title, url, type, description } = req.body;

        if (!title || typeof title !== "string" || title.trim().length > 200) {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: "Resource title is required and must be under 200 characters."
            });
        }

        if (!url || typeof url !== "string" || (!url.startsWith("http://") && !url.startsWith("https://")) || url.length > 2000) {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: "Resource URL must begin with http:// or https:// and be under 2,000 characters."
            });
        }

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        const isMember = await isUserMeetingMember(req.user.id, meeting);
        if (!isMember) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only organization members can add resources."
            });
        }

        if (!meeting.workspace) meeting.workspace = {};
        if (!meeting.workspace.resources) meeting.workspace.resources = [];

        const newResource = {
            title: title.trim(),
            url: url.trim(),
            type: ["link", "document", "repository", "other"].includes(type) ? type : "link",
            description: description ? description.trim() : "",
            createdBy: req.user.id,
            createdAt: new Date()
        };

        meeting.workspace.resources.push(newResource);
        await meeting.save();

        const createdResource = meeting.workspace.resources[meeting.workspace.resources.length - 1];

        return res.status(httpStatus.CREATED).json({
            message: "Resource added successfully",
            resource: createdResource
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to add resource: `
        });
    }
};

/**
 * Delete reference resource.
 * Host, Admin, or Resource Creator only.
 */
export const deleteResource = async (req, res) => {
    try {
        const { meetingCode, resourceId } = req.params;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        const resource = meeting.workspace?.resources?.id(resourceId);
        if (!resource) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Resource not found" });
        }

        const isHost = await isUserMeetingHostOrAdmin(req.user.id, meeting);
        const isCreator = resource.createdBy && resource.createdBy.toString() === req.user.id.toString();

        if (!isHost && !isCreator) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only the meeting host, admin, or resource creator can delete resources."
            });
        }

        meeting.workspace.resources.pull(resourceId);
        await meeting.save();

        return res.status(httpStatus.OK).json({ message: "Resource deleted successfully" });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to delete resource: `
        });
    }
};

/**
 * ==========================================
 * PHASE 6: PERSISTENT MEETING CHAT HANDLERS
 * ==========================================
 */

/**
 * Get paginated chat messages for a meeting.
 * Authenticated members or guests (if allowGuestAccess === true).
 */
export const getMeetingMessages = async (req, res) => {
    try {
        const { meetingCode } = req.params;
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
        const before = req.query.before;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        // Authorization check
        if (req.user) {
            const isMember = await isUserMeetingMember(req.user.id, meeting);
            if (!isMember) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "You are not a member of the organization hosting this meeting."
                });
            }
        } else {
            // Guest check
            if (!meeting.settings?.allowGuestAccess) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Guest access is disabled for this meeting."
                });
            }
        }

        const query = { meetingCode };
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
            .sort({ createdAt: 1 })
            .limit(limit)
            .lean();

        const total = await Message.countDocuments({ meetingCode });

        return res.status(httpStatus.OK).json({
            messages,
            total,
            hasMore: messages.length === limit
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to fetch messages: `
        });
    }
};

/**
 * Send a new chat message.
 * Authenticated members only.
 */
export const sendMeetingMessage = async (req, res) => {
    try {
        const { meetingCode } = req.params;
        const { message } = req.body;

        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(httpStatus.BAD_REQUEST).json({ message: "Message content cannot be empty." });
        }

        if (message.trim().length > 2000) {
            return res.status(httpStatus.BAD_REQUEST).json({ message: "Message cannot exceed 2000 characters." });
        }

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        const isMember = await isUserMeetingMember(req.user.id, meeting);
        if (!isMember) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "You are not a member of the organization hosting this meeting."
            });
        }

        const isHost = await isUserMeetingHostOrAdmin(req.user.id, meeting);
        if (meeting.settings?.allowChat === false && !isHost) {
            return res.status(httpStatus.FORBIDDEN).json({ message: "Chat has been disabled by the host." });
        }

        const newMessage = new Message({
            meeting: meeting._id,
            meetingCode: meeting.meetingCode,
            organization: meeting.organization,
            sender: req.user.id,
            senderName: req.body.senderName || req.user.name || req.user.username,
            message: message.trim()
        });

        await newMessage.save();

        return res.status(httpStatus.CREATED).json({
            message: "Message sent successfully",
            chatMessage: newMessage
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to send message: `
        });
    }
};

/**
 * Edit an existing chat message.
 * Author only. Cannot edit deleted messages.
 */
export const editMeetingMessage = async (req, res) => {
    try {
        const { meetingCode, messageId } = req.params;
        const { message } = req.body;

        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(httpStatus.BAD_REQUEST).json({ message: "Message content cannot be empty." });
        }

        if (message.trim().length > 2000) {
            return res.status(httpStatus.BAD_REQUEST).json({ message: "Message cannot exceed 2000 characters." });
        }

        const chatMessage = await Message.findById(messageId);
        if (!chatMessage || chatMessage.meetingCode !== meetingCode) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Message not found" });
        }

        if (chatMessage.isDeleted) {
            return res.status(httpStatus.BAD_REQUEST).json({ message: "Cannot edit a deleted message." });
        }

        if (chatMessage.sender.toString() !== req.user.id.toString()) {
            return res.status(httpStatus.FORBIDDEN).json({ message: "You can only edit your own messages." });
        }

        chatMessage.message = message.trim();
        chatMessage.isEdited = true;
        chatMessage.updatedAt = new Date();

        await chatMessage.save();

        return res.status(httpStatus.OK).json({
            message: "Message edited successfully",
            chatMessage
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to edit message: `
        });
    }
};

/**
 * Delete a chat message.
 * Author or Host/Admin moderation.
 */
export const deleteMeetingMessage = async (req, res) => {
    try {
        const { meetingCode, messageId } = req.params;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        const chatMessage = await Message.findById(messageId);
        if (!chatMessage || chatMessage.meetingCode !== meetingCode) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Message not found" });
        }

        const isAuthor = chatMessage.sender && chatMessage.sender.toString() === req.user.id.toString();
        const isHost = await isUserMeetingHostOrAdmin(req.user.id, meeting);

        if (!isAuthor && !isHost) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "You can only delete your own messages unless you are the host or admin."
            });
        }

        chatMessage.isDeleted = true;
        chatMessage.message = "This message was deleted";
        chatMessage.updatedAt = new Date();

        await chatMessage.save();

        return res.status(httpStatus.OK).json({
            message: "Message deleted successfully",
            chatMessage
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to delete message: `
        });
    }
};

/**
 * React to a chat message (toggle reaction).
 * Authenticated members only.
 */
export const reactToMeetingMessage = async (req, res) => {
    try {
        const { meetingCode, messageId } = req.params;
        const { emoji } = req.body;

        if (!emoji || typeof emoji !== "string" || !emoji.trim()) {
            return res.status(httpStatus.BAD_REQUEST).json({ message: "Emoji cannot be empty." });
        }

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        const isMember = await isUserMeetingMember(req.user.id, meeting);
        if (!isMember) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "You are not a member of the organization hosting this meeting."
            });
        }

        const chatMessage = await Message.findById(messageId);
        if (!chatMessage || chatMessage.meetingCode !== meetingCode) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Message not found" });
        }

        if (chatMessage.isDeleted) {
            return res.status(httpStatus.BAD_REQUEST).json({ message: "Cannot react to a deleted message." });
        }

        const existingIndex = chatMessage.reactions.findIndex(
            r => r.user.toString() === req.user.id.toString() && r.emoji === emoji.trim()
        );

        if (existingIndex > -1) {
            // Toggle off
            chatMessage.reactions.splice(existingIndex, 1);
        } else {
            // Add reaction
            chatMessage.reactions.push({
                emoji: emoji.trim(),
                user: req.user.id,
                username: req.user.name || req.user.username,
                createdAt: new Date()
            });
        }

        await chatMessage.save();

        return res.status(httpStatus.OK).json({
            message: "Reaction updated successfully",
            chatMessage
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to update reaction: `
        });
    }
};

// ==========================================
// PHASE 7: MEETING RECORDING & MEDIA MANAGEMENT
// ==========================================

/**
 * PHASE 7: Start Meeting Recording
 * Host or organization admin/owner initiates recording.
 */
export const startMeetingRecording = async (req, res) => {
    try {
        const { meetingCode } = req.params;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        // Cross-tenant verification: if meeting belongs to an org, verify user belongs to same org
        if (meeting.organization && req.organization) {
            if (meeting.organization.toString() !== req.organization._id.toString()) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Access denied. Cross-tenant meeting access rejected."
                });
            }
        }

        // Authorization check: must be host or org admin/owner
        const isAuthorized = await isUserMeetingHostOrAdmin(req.user.id, meeting);
        if (!isAuthorized) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only the meeting host or organization admin can start recording"
            });
        }

        if (meeting.organization) {
            const entitlementCheck = await entitlementService.canUseFeature(meeting.organization, "recording");
            if (!entitlementCheck.allowed) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Feature not available on the current plan",
                    code: "FEATURE_NOT_ENTITLED"
                });
            }
        }

        // Check allowRecording setting
        if (meeting.settings && meeting.settings.allowRecording === false) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Recording is disabled for this meeting"
            });
        }

        // Check meeting status
        if (meeting.status === "ended") {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: "Cannot record an ended meeting"
            });
        }

        // Check for active recording
        const activeRecording = (meeting.recordings || []).find(r => r.status === "recording");
        if (activeRecording) {
            return res.status(httpStatus.CONFLICT).json({
                message: "A recording is already in progress for this meeting",
                recordingId: activeRecording._id
            });
        }

        const newRecording = {
            startedBy: req.user.id,
            startedByName: req.user.name || req.user.username || "Host",
            startedAt: new Date(),
            status: "recording",
            storageProvider: "local",
            storageKey: "",
            mimeType: "video/webm"
        };

        meeting.recordings.push(newRecording);
        await meeting.save();

        const createdRecording = meeting.recordings[meeting.recordings.length - 1];

        return res.status(httpStatus.CREATED).json({
            message: "Recording started successfully",
            recording: createdRecording
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to start recording: `
        });
    }
};

/**
 * PHASE 7: Stop Meeting Recording and Finalize Media Upload
 * Uploads final media blob, writes via StorageService, updates recording metadata.
 */
export const stopMeetingRecording = async (req, res) => {
    try {
        const { meetingCode, recordingId } = req.params;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        // Tenant verification
        if (meeting.organization && req.organization) {
            if (meeting.organization.toString() !== req.organization._id.toString()) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Access denied. Cross-tenant meeting access rejected."
                });
            }
        }

        // Authorization check: host or org admin
        const isAuthorized = await isUserMeetingHostOrAdmin(req.user.id, meeting);
        if (!isAuthorized) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only the meeting host or organization admin can stop recording"
            });
        }

        const recording = meeting.recordings.id(recordingId);
        if (!recording) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Recording not found" });
        }

        if (recording.status !== "recording") {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: `Recording is not currently active (current status: ${recording.status})`
            });
        }

        // Generate safe server-authoritative storage key
        const storageKey = `recording_${meeting._id}_${recording._id}.webm`;

        // Check if request is streaming or has buffer
        let saveResult;
        if (Buffer.isBuffer(req.body)) {
            saveResult = await storageService.saveBuffer(storageKey, req.body);
        } else if (req.body && req.body.data && typeof req.body.data === "string") {
            const buffer = Buffer.from(req.body.data, "base64");
            saveResult = await storageService.saveBuffer(storageKey, buffer);
        } else {
            saveResult = await storageService.saveStream(storageKey, req);
        }

        const stats = await storageService.getFileStats(storageKey);
        const fileSize = stats ? stats.size : saveResult.bytesWritten;
        const endedAt = new Date();
        const duration = Math.max(1, Math.round((endedAt.getTime() - new Date(recording.startedAt).getTime()) / 1000));

        recording.endedAt = endedAt;
        recording.duration = duration;
        recording.storageKey = storageKey;
        recording.fileSize = fileSize;
        recording.status = fileSize > 0 ? "ready" : "failed";

        await meeting.save();

        if (meeting.organization && fileSize > 0) {
            const storageGB = fileSize / (1024 * 1024 * 1024);
            await usageService.incrementUsage(meeting.organization, "storage_gb", storageGB);
        }

        return res.status(httpStatus.OK).json({
            message: "Recording stopped and media stored successfully",
            recording
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to stop recording: `
        });
    }
};

/**
 * PHASE 7: Get All Recordings Metadata for a Meeting
 * Accessible to authenticated organization members. Guests rejected.
 */
export const getMeetingRecordings = async (req, res) => {
    try {
        const { meetingCode } = req.params;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        // Cross-tenant verification
        if (meeting.organization && req.organization) {
            if (meeting.organization.toString() !== req.organization._id.toString()) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Access denied. Cross-tenant meeting access rejected."
                });
            }
        }

        // Verify user is an active member or host
        const isMember = await isUserMeetingMember(req.user.id, meeting);
        if (!isMember) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only organization members can view meeting recordings"
            });
        }

        const activeRecordings = (meeting.recordings || []).filter(r => r.status !== "deleted");

        return res.status(httpStatus.OK).json({
            meetingCode: meeting.meetingCode,
            recordings: activeRecordings
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to fetch recordings: `
        });
    }
};

/**
 * PHASE 7: Get Details for a Specific Recording
 */
export const getMeetingRecordingDetails = async (req, res) => {
    try {
        const { meetingCode, recordingId } = req.params;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        // Cross-tenant verification
        if (meeting.organization && req.organization) {
            if (meeting.organization.toString() !== req.organization._id.toString()) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Access denied. Cross-tenant meeting access rejected."
                });
            }
        }

        const isMember = await isUserMeetingMember(req.user.id, meeting);
        if (!isMember) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only organization members can view meeting recording details"
            });
        }

        const recording = meeting.recordings.id(recordingId);
        if (!recording || recording.status === "deleted") {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Recording not found" });
        }

        return res.status(httpStatus.OK).json({
            meetingCode: meeting.meetingCode,
            recording
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to fetch recording details: `
        });
    }
};

/**
 * PHASE 7: Byte-Range Media Streaming & Download
 * Supports HTTP 206 Partial Content (Range requests) for seeking and 200 OK for full media.
 */
export const streamMeetingRecordingMedia = async (req, res) => {
    try {
        const { meetingCode, recordingId } = req.params;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        // Cross-tenant verification
        if (meeting.organization && req.organization) {
            if (meeting.organization.toString() !== req.organization._id.toString()) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Access denied. Cross-tenant meeting access rejected."
                });
            }
        }

        const isMember = await isUserMeetingMember(req.user.id, meeting);
        if (!isMember) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only organization members can stream meeting recordings"
            });
        }

        const recording = meeting.recordings.id(recordingId);
        if (!recording || recording.status === "deleted" || recording.status !== "ready") {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Recording media not ready or not found" });
        }

        const stats = await storageService.getFileStats(recording.storageKey);
        if (!stats) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Physical recording file not found" });
        }

        const fileSize = stats.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (isNaN(start) || start >= fileSize || (parts[1] && end >= fileSize) || start > end) {
                res.setHeader("Content-Range", `bytes */${fileSize}`);
                return res.status(httpStatus.REQUESTED_RANGE_NOT_SATISFIABLE).end();
            }

            const chunkSize = (end - start) + 1;
            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunkSize,
                "Content-Type": recording.mimeType || "video/webm"
            });

            const stream = storageService.getStream(recording.storageKey, { start, end });
            stream.pipe(res);
        } else {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Accept-Ranges": "bytes",
                "Content-Type": recording.mimeType || "video/webm"
            });

            const stream = storageService.getStream(recording.storageKey);
            stream.pipe(res);
        }
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to stream media: `
        });
    }
};

/**
 * PHASE 7: Delete Meeting Recording
 * Host or organization admin only. Deletes physical media and marks recording deleted.
 */
export const deleteMeetingRecording = async (req, res) => {
    try {
        const { meetingCode, recordingId } = req.params;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        // Tenant verification
        if (meeting.organization && req.organization) {
            if (meeting.organization.toString() !== req.organization._id.toString()) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Access denied. Cross-tenant meeting access rejected."
                });
            }
        }

        // Authorization check: host or org admin
        const isAuthorized = await isUserMeetingHostOrAdmin(req.user.id, meeting);
        if (!isAuthorized) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only the meeting host or organization admin can delete recordings"
            });
        }

        const recording = meeting.recordings.id(recordingId);
        if (!recording || recording.status === "deleted") {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Recording not found" });
        }

        // Delete physical file
        if (recording.storageKey) {
            await storageService.delete(recording.storageKey);
        }

        // Delete associated knowledge chunks
        const transcripts = await Transcript.find({ recordingId });
        for (const tr of transcripts) {
            await deleteTranscriptKnowledge(tr._id);
            tr.status = "failed"; // Mark as unavailable
            await tr.save();
        }

        recording.status = "deleted";
        await meeting.save();

        return res.status(httpStatus.OK).json({
            message: "Recording deleted successfully"
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to delete recording: `
        });
    }
};

// ==========================================
// PHASE 8: MEETING TRANSCRIPTION & SEARCHABLE TRANSCRIPT
// ==========================================

/**
 * PHASE 8: Start Recording Transcription
 * Initiates transcription for an existing ready recording.
 * Host or organization admin authorized.
 * Idempotent: returns existing state if already queued, processing, or completed.
 * Allows controlled retry if failed.
 */
export const startRecordingTranscription = async (req, res) => {
    try {
        const { meetingCode, recordingId } = req.params;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        // Cross-tenant verification
        if (meeting.organization && req.organization) {
            if (meeting.organization.toString() !== req.organization._id.toString()) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Access denied. Cross-tenant meeting access rejected."
                });
            }
        }

        // Host/Admin authorization check
        const isAuthorized = await isUserMeetingHostOrAdmin(req.user.id, meeting);
        if (!isAuthorized) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only the meeting host or organization admin can start transcription"
            });
        }

        if (meeting.organization) {
            const entitlementCheck = await entitlementService.canUseFeature(meeting.organization, "transcription");
            if (!entitlementCheck.allowed) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Feature not available on the current plan",
                    code: "FEATURE_NOT_ENTITLED"
                });
            }
        }

        const recording = meeting.recordings.id(recordingId);
        if (!recording || recording.status === "deleted") {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Recording not found" });
        }

        if (recording.status !== "ready") {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: `Recording is not ready for transcription (current status: ${recording.status})`
            });
        }

        if (!recording.storageKey) {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: "Recording has no associated media file"
            });
        }

        const stats = await storageService.getFileStats(recording.storageKey);
        if (!stats) {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: "Physical recording media file not found on disk"
            });
        }

        // Check for existing transcript (idempotency)
        let transcript = await Transcript.findOne({
            organization: meeting.organization,
            meeting: meeting._id,
            recordingId: recording._id
        });

        if (transcript) {
            if (transcript.status === "queued" || transcript.status === "processing") {
                return res.status(httpStatus.OK).json({
                    message: "Transcription is already in progress",
                    transcript
                });
            }

            if (transcript.status === "completed") {
                return res.status(httpStatus.OK).json({
                    message: "Transcription has already completed",
                    transcript
                });
            }

            // If failed, allow controlled retry by resetting state
            transcript.status = "queued";
            transcript.error = null;
            transcript.provider = transcriptionService.getProviderName();
            transcript.startedAt = new Date();
            transcript.completedAt = null;
            await transcript.save();
        } else {
            transcript = new Transcript({
                organization: meeting.organization,
                meeting: meeting._id,
                meetingCode: meeting.meetingCode,
                recordingId: recording._id,
                provider: transcriptionService.getProviderName(),
                status: "queued",
                startedAt: new Date()
            });
            await transcript.save();
        }

        // Broadcast transcription started event
        broadcastTranscriptionEvent(meetingCode, "meeting:transcription-started", {
            meetingCode,
            recordingId: recording._id,
            provider: transcript.provider,
            status: "queued"
        });

        // Trigger transcription processing asynchronously (do not block HTTP response)
        await transcriptionQueue.add("transcribe", {
            transcriptId: transcript._id.toString(),
            recordingId: recording._id.toString(),
            meetingCode,
            organizationId: meeting.organization.toString()
        });

        return res.status(httpStatus.ACCEPTED).json({
            message: "Transcription job queued successfully",
            transcript
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to start transcription: `
        });
    }
};

/**
 * PHASE 8: Get Recording Transcription Status
 * Returns status metadata only (status, provider, language, duration, startedAt, completedAt, error).
 * Accessible to authenticated organization members.
 */
export const getRecordingTranscriptionStatus = async (req, res) => {
    try {
        const { meetingCode, recordingId } = req.params;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        // Cross-tenant verification
        if (meeting.organization && req.organization) {
            if (meeting.organization.toString() !== req.organization._id.toString()) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Access denied. Cross-tenant meeting access rejected."
                });
            }
        }

        const isMember = await isUserMeetingMember(req.user.id, meeting);
        if (!isMember) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only organization members can view transcription status"
            });
        }

        const recording = meeting.recordings.id(recordingId);
        if (!recording || recording.status === "deleted") {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Recording not found" });
        }

        const transcript = await Transcript.findOne({
            organization: meeting.organization,
            meeting: meeting._id,
            recordingId: recording._id
        });

        if (!transcript) {
            return res.status(httpStatus.NOT_FOUND).json({
                message: "Transcription not started for this recording",
                status: "not_started"
            });
        }

        return res.status(httpStatus.OK).json({
            status: transcript.status,
            provider: transcript.provider,
            language: transcript.language,
            duration: transcript.duration,
            startedAt: transcript.startedAt,
            completedAt: transcript.completedAt,
            error: transcript.error
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to fetch transcription status: `
        });
    }
};

/**
 * PHASE 8: Get Completed Transcript
 * Returns transcript data (segments, rawText, duration, language, provider).
 * Only returns when status === "completed".
 * Accessible to authenticated organization members.
 */
export const getRecordingTranscript = async (req, res) => {
    try {
        const { meetingCode, recordingId } = req.params;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        // Cross-tenant verification
        if (meeting.organization && req.organization) {
            if (meeting.organization.toString() !== req.organization._id.toString()) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Access denied. Cross-tenant meeting access rejected."
                });
            }
        }

        const isMember = await isUserMeetingMember(req.user.id, meeting);
        if (!isMember) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only organization members can view meeting transcripts"
            });
        }

        const recording = meeting.recordings.id(recordingId);
        if (!recording || recording.status === "deleted") {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Recording not found" });
        }

        const transcript = await Transcript.findOne({
            organization: meeting.organization,
            meeting: meeting._id,
            recordingId: recording._id
        });

        if (!transcript) {
            return res.status(httpStatus.NOT_FOUND).json({
                message: "Transcript not found for this recording"
            });
        }

        if (transcript.status !== "completed") {
            return res.status(httpStatus.CONFLICT).json({
                message: `Transcript is not ready yet (current status: ${transcript.status})`,
                status: transcript.status
            });
        }

        return res.status(httpStatus.OK).json({
            segments: transcript.segments,
            rawText: transcript.rawText,
            duration: transcript.duration,
            language: transcript.language,
            provider: transcript.provider
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to fetch transcript: `
        });
    }
};

/**
 * PHASE 8: Search Transcript
 * Performs case-insensitive, text-based search on transcript segments.
 * Returns matching segments: [ { start, end, text, speaker } ].
 * Accessible to authenticated organization members.
 */
export const searchRecordingTranscript = async (req, res) => {
    try {
        const { meetingCode, recordingId } = req.params;
        const query = (req.query.q || "").trim().toLowerCase();

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        // Cross-tenant verification
        if (meeting.organization && req.organization) {
            if (meeting.organization.toString() !== req.organization._id.toString()) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Access denied. Cross-tenant meeting access rejected."
                });
            }
        }

        const isMember = await isUserMeetingMember(req.user.id, meeting);
        if (!isMember) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only organization members can search meeting transcripts"
            });
        }

        const recording = meeting.recordings.id(recordingId);
        if (!recording || recording.status === "deleted") {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Recording not found" });
        }

        const transcript = await Transcript.findOne({
            organization: meeting.organization,
            meeting: meeting._id,
            recordingId: recording._id
        });

        if (!transcript) {
            return res.status(httpStatus.NOT_FOUND).json({
                message: "Transcript not found for this recording"
            });
        }

        if (transcript.status !== "completed") {
            return res.status(httpStatus.CONFLICT).json({
                message: `Transcript is not ready yet (current status: ${transcript.status})`,
                status: transcript.status
            });
        }

        if (!query) {
            return res.status(httpStatus.OK).json([]);
        }

        const matchedSegments = (transcript.segments || [])
            .filter(seg => seg.text && seg.text.toLowerCase().includes(query))
            .map(seg => ({
                start: seg.start,
                end: seg.end,
                text: seg.text,
                speaker: seg.speaker || null
            }));

        return res.status(httpStatus.OK).json(matchedSegments);
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to search transcript: `
        });
    }
};

/**
 * PHASE 9: Start Meeting AI Intelligence Generation
 * Analyzes completed transcript and extracts structured intelligence.
 * Host/Admin only. Idempotent.
 */
export const startMeetingIntelligence = async (req, res) => {
    try {
        const { meetingCode, recordingId } = req.params;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        const isHost = await isUserMeetingHostOrAdmin(req.user.id, meeting);
        if (!isHost) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only the meeting host or admin can generate AI intelligence."
            });
        }

        if (meeting.organization) {
            const entitlementCheck = await entitlementService.canUseFeature(meeting.organization, "meetingAI");
            if (!entitlementCheck.allowed) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Feature not available on the current plan",
                    code: "FEATURE_NOT_ENTITLED"
                });
            }
        }

        const recording = meeting.recordings.id(recordingId);
        if (!recording || recording.status === "deleted") {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Recording not found" });
        }

        const transcript = await Transcript.findOne({
            organization: meeting.organization,
            meeting: meeting._id,
            recordingId: recording._id
        });

        if (!transcript) {
            return res.status(httpStatus.NOT_FOUND).json({
                message: "Transcript not found for this recording"
            });
        }

        if (transcript.status !== "completed") {
            return res.status(httpStatus.CONFLICT).json({
                message: `Transcript is not completed yet (current status: ${transcript.status})`
            });
        }

        // Check for existing intelligence (idempotency)
        let intelligence = await MeetingIntelligence.findOne({
            organization: meeting.organization,
            meeting: meeting._id,
            recordingId: recording._id,
            transcriptId: transcript._id
        });

        if (intelligence) {
            if (intelligence.status === "queued" || intelligence.status === "processing") {
                return res.status(httpStatus.OK).json({
                    message: "AI analysis is already in progress",
                    intelligence
                });
            }

            if (intelligence.status === "completed") {
                return res.status(httpStatus.OK).json({
                    message: "AI analysis has already completed",
                    intelligence
                });
            }

            // If failed, allow controlled retry
            intelligence.status = "queued";
            intelligence.error = null;
            intelligence.startedAt = new Date();
            intelligence.completedAt = null;
            await intelligence.save();
        } else {
            intelligence = new MeetingIntelligence({
                organization: meeting.organization,
                meeting: meeting._id,
                recordingId: recording._id,
                transcriptId: transcript._id,
                provider: "openai",
                model: meetingAIService.model,
                status: "queued",
                startedAt: new Date()
            });
            await intelligence.save();
        }

        broadcastAIEvent?.(meetingCode, "meeting:ai-started", {
            meetingCode,
            recordingId: recording._id,
            status: "queued"
        });

        // Trigger processing asynchronously via background worker
        await intelligenceQueue.add("analyze", {
            intelligenceId: intelligence._id.toString(),
            transcriptId: transcript._id.toString(),
            meetingCode,
            recordingId: recording._id.toString(),
            organizationId: meeting.organization.toString()
        });

        return res.status(httpStatus.ACCEPTED).json({
            message: "AI generation job queued successfully",
            intelligence
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to start AI generation: `
        });
    }
};

/**
 * PHASE 9: Get Meeting AI Intelligence
 * Returns status and generated intelligence data.
 * Accessible to authenticated organization members.
 */
export const getMeetingIntelligence = async (req, res) => {
    try {
        const { meetingCode, recordingId } = req.params;

        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        if (meeting.organization && req.organization) {
            if (meeting.organization.toString() !== req.organization._id.toString()) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Access denied. Cross-tenant meeting access rejected."
                });
            }
        }

        const isMember = await isUserMeetingMember(req.user.id, meeting);
        if (!isMember) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Only organization members can view meeting intelligence"
            });
        }

        const recording = meeting.recordings.id(recordingId);
        if (!recording || recording.status === "deleted") {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Recording not found" });
        }

        const intelligence = await MeetingIntelligence.findOne({
            organization: meeting.organization,
            meeting: meeting._id,
            recordingId: recording._id
        });

        if (!intelligence) {
            return res.status(httpStatus.NOT_FOUND).json({
                message: "AI intelligence not found for this recording",
                status: "not_started"
            });
        }

        return res.status(httpStatus.OK).json({
            status: intelligence.status,
            provider: intelligence.provider,
            model: intelligence.model,
            summary: intelligence.summary,
            keyPoints: intelligence.keyPoints,
            decisions: intelligence.decisions,
            actionItems: intelligence.actionItems,
            topics: intelligence.topics,
            startedAt: intelligence.startedAt,
            completedAt: intelligence.completedAt,
            error: intelligence.error
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to fetch AI intelligence: `
        });
    }
};

/**
 * ==========================================
 * PHASE 11: LIVEKIT REALTIME TOKEN
 * ==========================================
 */

export const generateRealtimeToken = async (req, res) => {
    try {
        const { meetingCode } = req.params;
        const { socketId } = req.body; // Passed by the client for guests

        // 1. Resolve canonical meeting
        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }

        // 3. Meeting status check (Prevent generating tokens for ended meetings)
        if (meeting.status === "ended") {
            return res.status(httpStatus.FORBIDDEN).json({ message: "This meeting has ended." });
        }

        // 4. Authorization & Roles
        const isHost = await isUserMeetingHostOrAdmin(req.user?.id, meeting);
        const isMember = await isUserMeetingMember(req.user?.id, meeting);

        // Guest handling
        if (!isHost && !isMember) {
            if (!meeting.settings.allowGuestAccess) {
                return res.status(httpStatus.FORBIDDEN).json({ message: "Guest access is disabled for this meeting." });
            }
        }

        // 5. Generate token using the LiveKit service
        const participantName = req.user ? req.user.username : "Guest";

        const realtimeData = await livekitService.generateRealtimeToken({
            meetingId: meeting._id,
            userId: req.user?.id, // undefined for guests
            isHost,
            participantName,
            socketId
        });

        // 6. Return strictly token and URL
        return res.status(httpStatus.OK).json({
            token: realtimeData.token,
            url: realtimeData.url
        });
    } catch (error) {
        logger.error("Error generating realtime token:", error);
        
        if (error.statusCode === 501) {
            return res.status(httpStatus.NOT_IMPLEMENTED).json({ message: "Internal error" });
        }

        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Failed to generate realtime token." });
    }
};
