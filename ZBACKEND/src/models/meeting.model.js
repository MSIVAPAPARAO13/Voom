import mongoose, { Schema } from "mongoose";

const meetingSchema = new Schema(
    {
        organization: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            index: true
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            index: true
        },
        user_id: {
            type: String, // Kept for backward compatibility with Phase 1/2 username lookup
            index: true
        },
        meetingCode: {
            type: String,
            required: true,
            index: true
        },
        title: {
            type: String,
            default: "Untitled Meeting",
            trim: true
        },
        description: {
            type: String,
            default: "",
            trim: true
        },
        status: {
            type: String,
            enum: ["scheduled", "live", "ended"],
            default: "live",
            index: true
        },
        settings: {
            allowGuestAccess: {
                type: Boolean,
                default: true
            },
            waitingRoomEnabled: {
                type: Boolean,
                default: false
            },
            allowScreenShare: {
                type: Boolean,
                default: true
            },
            allowChat: {
                type: Boolean,
                default: true
            },
            allowParticipantUnmute: {
                type: Boolean,
                default: true
            },
            allowRecording: {
                type: Boolean,
                default: true
            }
        },
        startedAt: {
            type: Date,
            default: Date.now
        },
        endedAt: {
            type: Date,
            default: null
        },
        workspace: {
            notes: {
                content: {
                    type: String,
                    default: "",
                    maxLength: 50000
                },
                updatedBy: {
                    type: Schema.Types.ObjectId,
                    ref: "User",
                    default: null
                },
                updatedAt: {
                    type: Date,
                    default: null
                },
                version: {
                    type: Number,
                    default: 1
                }
            },
            agenda: [
                {
                    title: {
                        type: String,
                        required: true,
                        trim: true,
                        maxLength: 200
                    },
                    description: {
                        type: String,
                        default: "",
                        maxLength: 1000
                    },
                    order: {
                        type: Number,
                        default: 0
                    },
                    status: {
                        type: String,
                        enum: ["pending", "active", "completed"],
                        default: "pending"
                    },
                    duration: {
                        type: Number,
                        default: 0
                    },
                    createdBy: {
                        type: Schema.Types.ObjectId,
                        ref: "User"
                    },
                    createdAt: {
                        type: Date,
                        default: Date.now
                    }
                }
            ],
            tasks: [
                {
                    title: {
                        type: String,
                        required: true,
                        trim: true,
                        maxLength: 200
                    },
                    description: {
                        type: String,
                        default: "",
                        maxLength: 1000
                    },
                    assignedTo: {
                        type: Schema.Types.ObjectId,
                        ref: "User",
                        default: null
                    },
                    status: {
                        type: String,
                        enum: ["todo", "in_progress", "completed"],
                        default: "todo"
                    },
                    dueDate: {
                        type: Date,
                        default: null
                    },
                    createdBy: {
                        type: Schema.Types.ObjectId,
                        ref: "User"
                    },
                    createdAt: {
                        type: Date,
                        default: Date.now
                    },
                    updatedAt: {
                        type: Date,
                        default: Date.now
                    }
                }
            ],
            resources: [
                {
                    title: {
                        type: String,
                        required: true,
                        trim: true,
                        maxLength: 200
                    },
                    url: {
                        type: String,
                        required: true,
                        trim: true,
                        maxLength: 2000
                    },
                    type: {
                        type: String,
                        enum: ["link", "document", "repository", "other"],
                        default: "link"
                    },
                    description: {
                        type: String,
                        default: "",
                        maxLength: 500
                    },
                    createdBy: {
                        type: Schema.Types.ObjectId,
                        ref: "User"
                    },
                    createdAt: {
                        type: Date,
                        default: Date.now
                    }
                }
            ]
        },
        recordings: [
            {
                startedBy: {
                    type: Schema.Types.ObjectId,
                    ref: "User"
                },
                startedByName: {
                    type: String,
                    default: ""
                },
                startedAt: {
                    type: Date,
                    default: Date.now
                },
                endedAt: {
                    type: Date,
                    default: null
                },
                duration: {
                    type: Number,
                    default: 0
                },
                status: {
                    type: String,
                    enum: ["recording", "processing", "ready", "failed", "deleted"],
                    default: "recording"
                },
                storageProvider: {
                    type: String,
                    default: "local"
                },
                storageKey: {
                    type: String,
                    default: ""
                },
                fileSize: {
                    type: Number,
                    default: 0
                },
                mimeType: {
                    type: String,
                    default: "video/webm"
                },
                createdAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],
        date: {
            type: Date,
            default: Date.now,
            required: true
        }
    },
    { timestamps: true }
);

// Compound index: tenant-scoped meeting lookup
meetingSchema.index({ organization: 1, meetingCode: 1 });

const Meeting = mongoose.model("Meeting", meetingSchema);

export { Meeting };