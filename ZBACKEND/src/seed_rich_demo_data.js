import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import path from 'path';

dotenv.config();

async function seed() {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully.");

    const User = mongoose.model('User', new mongoose.Schema({
        name: String,
        username: { type: String, unique: true },
        password: String,
        role: String
    }, { timestamps: true }));

    const Organization = mongoose.model('Organization', new mongoose.Schema({
        name: String,
        slug: { type: String, unique: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }, { timestamps: true }));

    const Membership = mongoose.model('Membership', new mongoose.Schema({
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
        role: String
    }, { timestamps: true }));

    const Meeting = mongoose.model('Meeting', new mongoose.Schema({
        organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        user_id: String,
        meetingCode: String,
        title: String,
        description: String,
        status: String,
        date: Date,
        settings: Object,
        workspace: Object,
        recordings: Array
    }, { timestamps: true }));

    const Message = mongoose.model('Message', new mongoose.Schema({
        meeting: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },
        meetingCode: String,
        organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        senderName: String,
        message: String,
        createdAt: { type: Date, default: Date.now }
    }));

    const Transcript = mongoose.model('Transcript', new mongoose.Schema({
        organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
        meeting: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },
        meetingCode: String,
        recordingId: mongoose.Schema.Types.ObjectId,
        provider: String,
        status: String,
        language: String,
        duration: Number,
        fullText: String,
        segments: Array
    }, { timestamps: true }));

    // 1. Create or Find User
    const hashedPassword = await bcrypt.hash("Password123!", 10);
    let user = await User.findOne({ username: "voom_admin" });
    if (!user) {
        user = await User.create({
            name: "Siva (Lead Architect)",
            username: "voom_admin",
            password: hashedPassword,
            role: "admin"
        });
        console.log("Created user: voom_admin");
    } else {
        user.name = "Siva (Lead Architect)";
        user.password = hashedPassword;
        await user.save();
        console.log("Updated user: voom_admin");
    }

    // 2. Create or Find Organization
    let org = await Organization.findOne({ slug: "voom-enterprise" });
    if (!org) {
        org = await Organization.create({
            name: "Voom Enterprise Engineering",
            slug: "voom-enterprise",
            createdBy: user._id
        });
        console.log("Created organization: Voom Enterprise Engineering");
    }

    // Ensure Membership
    await Membership.findOneAndUpdate(
        { user: user._id, organization: org._id },
        { user: user._id, organization: org._id, role: "owner" },
        { upsert: true }
    );

    // 3. Clean up older seed meetings for this user
    await Meeting.deleteMany({ user_id: "voom_admin" });
    await Message.deleteMany({ meetingCode: { $in: ["arch-sync-941", "rag-plan-820", "sec-audit-105", "prod-review-312"] } });
    await Transcript.deleteMany({ meetingCode: "arch-sync-941" });

    // 4. Seed 4 Rich Meetings
    const recordingId1 = new mongoose.Types.ObjectId();
    const meeting1 = await Meeting.create({
        organization: org._id,
        createdBy: user._id,
        user_id: "voom_admin",
        meetingCode: "arch-sync-941",
        title: "Q3 Global Architecture & WebRTC Performance Sync",
        description: "Deep dive into WebRTC mesh latency, Redis pub/sub signaling, and BullMQ transcription workers.",
        status: "ended",
        date: new Date(Date.now() - 2 * 3600 * 1000), // 2 hours ago
        settings: { allowChat: true, allowScreenShare: true },
        workspace: {
            agenda: [
                { id: "1", title: "Review WebRTC P2P Latency Benchmarks", completed: true },
                { id: "2", title: "Evaluate BullMQ Audio Pipeline Throughput", completed: true },
                { id: "3", title: "Signaling Redis Adapter Horizontal Scaling", completed: false }
            ],
            notes: [
                { id: "n1", content: "P99 audio/video latency tested at 42ms on local edge mesh." },
                { id: "n2", content: "Worker queues auto-retry failed transcription jobs with exponential backoff." }
            ],
            actionItems: [
                { id: "a1", title: "Deploy Redis cluster on Render", assignee: "Siva", status: "completed" },
                { id: "a2", title: "Benchmark AssemblyAI vs Deepgram streaming latency", assignee: "Sarah", status: "in-progress" }
            ]
        },
        recordings: [
            {
                _id: recordingId1,
                fileName: "recording-arch-sync-941.webm",
                filePath: "storage/recordings/recording-arch-sync-941.webm",
                duration: 1845, // ~30 mins
                fileSize: 48500000,
                status: "ready",
                createdAt: new Date(Date.now() - 2 * 3600 * 1000)
            }
        ]
    });

    const meeting2 = await Meeting.create({
        organization: org._id,
        createdBy: user._id,
        user_id: "voom_admin",
        meetingCode: "rag-plan-820",
        title: "Ask Voom AI & RAG Pipeline Sprint Planning",
        description: "Designing semantic chunking, cosine vector similarity search, and automated meeting summarization.",
        status: "ended",
        date: new Date(Date.now() - 24 * 3600 * 1000), // 1 day ago
        settings: { allowChat: true, allowScreenShare: true },
        workspace: {
            agenda: [
                { id: "1", title: "Semantic audio chunking strategies (1000 chars / 200 overlap)", completed: true },
                { id: "2", title: "Prompt engineering for synthesis with citations", completed: true }
            ],
            notes: [
                { id: "n1", content: "Ask Voom now provides exact timestamp links back to the recording." }
            ]
        }
    });

    const meeting3 = await Meeting.create({
        organization: org._id,
        createdBy: user._id,
        user_id: "voom_admin",
        meetingCode: "sec-audit-105",
        title: "Enterprise Security, Tenant Isolation & SOC2 Audit",
        description: "Multi-tenant authorization, HttpOnly refresh token rotation, and rate limiter verification.",
        status: "ended",
        date: new Date(Date.now() - 3 * 24 * 3600 * 1000), // 3 days ago
        settings: { allowChat: true, allowScreenShare: true }
    });

    const meeting4 = await Meeting.create({
        organization: org._id,
        createdBy: user._id,
        user_id: "voom_admin",
        meetingCode: "prod-review-312",
        title: "Executive Product Roadmap & Active Meeting Redesign Review",
        description: "Full stage video canvas, glassmorphic bottom controls dock, and mobile responsiveness.",
        status: "live",
        date: new Date(),
        settings: { allowChat: true, allowScreenShare: true }
    });

    console.log("Seeded 4 rich meetings successfully.");

    // 5. Seed Real Chat Messages for meeting1 (arch-sync-941)
    const messages = [
        { senderName: "Siva (Host)", message: "Welcome team! Let's kick off the Q3 Architecture Sync." },
        { senderName: "Sarah Connor", message: "Hey Siva! Audio is crystal clear over the P2P connection." },
        { senderName: "Alex Vance", message: "WebRTC handshake completed in 140ms. Everything looks rock solid." },
        { senderName: "Elena Rostova", message: "I've uploaded the latency benchmarks into the shared workspace." },
        { senderName: "Siva (Host)", message: "Great! Let's walk through the Ask Voom vector search pipeline next." },
        { senderName: "Sarah Connor", message: "Agreed. Semantic chunks and embeddings are working seamlessly in test." }
    ];

    for (let i = 0; i < messages.length; i++) {
        await Message.create({
            meeting: meeting1._id,
            meetingCode: meeting1.meetingCode,
            organization: org._id,
            sender: user._id,
            senderName: messages[i].senderName,
            message: messages[i].message,
            createdAt: new Date(Date.now() - (30 - i * 5) * 60 * 1000)
        });
    }
    console.log("Seeded 6 real chat messages.");

    // 6. Seed Real Transcript for meeting1
    await Transcript.create({
        organization: org._id,
        meeting: meeting1._id,
        meetingCode: meeting1.meetingCode,
        recordingId: recordingId1,
        provider: "assemblyai",
        status: "completed",
        language: "en",
        duration: 1845,
        fullText: "Welcome team. Today we are reviewing the Voom real-time WebRTC architecture. Our peer-to-peer audio and video mesh is performing with sub-45ms latency. The BullMQ queue consumer is processing audio chunks reliably across all worker threads. Ask Voom vector search connects directly to our transcript embeddings for instant meeting memory.",
        segments: [
            { start: 0, end: 12, speaker: "Siva (Host)", text: "Welcome team. Today we are reviewing the Voom real-time WebRTC architecture." },
            { start: 13, end: 28, speaker: "Sarah Connor", text: "Our peer-to-peer audio and video mesh is performing with sub-45ms latency." },
            { start: 29, end: 46, speaker: "Alex Vance", text: "The BullMQ queue consumer is processing audio chunks reliably across all worker threads." },
            { start: 47, end: 72, speaker: "Elena Rostova", text: "Ask Voom vector search connects directly to our transcript embeddings for instant meeting memory." }
        ]
    });
    console.log("Seeded rich transcript segments.");

    process.exit(0);
}

seed().catch(err => {
    console.error("Seeding failed:", err);
    process.exit(1);
});
