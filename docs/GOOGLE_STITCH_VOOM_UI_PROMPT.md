GOOGLE STITCH PROJECT
---------------------
Project Name: Voom UI/UX Redesign
Project ID: 767416618324097414
Project URL: https://stitch.withgoogle.com/projects/767416618324097414

Instruction: "Use the existing Voom Stitch project. Do not create a duplicate project."

IMPORTANT CONSTRAINT:
"Design only functionality represented by the provided Voom product specification. Do not invent APIs, routes, backend capabilities, database fields, permissions, or unsupported features."

# Brand & Positioning
Brand: VOOM
Positioning: Meet. Collaborate. Remember.
Supporting statement: "Video meetings, collaboration, recordings and AI-powered meeting memory — all in one workspace."

Personality: Professional, modern, intelligent, trustworthy, productive, simple, premium, approachable. (Must look like a serious SaaS platform).

# Design System Requirements
* Colors: Restrained professional palette (Primary, Secondary, Background, Surface, Border, Success, Error).
* Typography: Modern, clean Sans-serif (Display, H1-H3, Body, Caption).
* Components: Consistent Border Radius, subtle shadows, unified iconography.
* Buttons: Primary, Secondary, Tertiary, Danger, Icon, Loading, Disabled.
* Cards: MeetingCard, RecordingCard, AIInsightCard, Workspace, Organization.
* Badges: Live, Upcoming, Completed, Processing, Failed, Recording, Admin, Owner.

# Application Shell
* Header: Voom Logo, Organization Selector, Profile avatar.
* Sidebar (Persistent on Desktop, Collapsible Tablet, Drawer Mobile): Home, History, Organization, Ask Voom.

# Required Screens (Using Synthetic Design Data)

SCREEN 01: Landing Page
- Hero: "VOOM - Meet. Collaborate. Remember."
- CTA: Get Started, Secondary: See How It Works.
- Sections: Meetings, Recording, AI intelligence, Voom Memory.

SCREEN 02: Login
- Fields: Email, Password, Show/Hide, Submit button. States: Loading, Error.

SCREEN 03: Register
- Fields: Name, Email, Password, Submit button.

SCREEN 04: Dashboard
- Welcome back message.
- Upcoming meetings, Recent meetings, Recent recordings. Empty state included.

SCREEN 05: Create Meeting
- Input for Title/Description. CTA: Create.

SCREEN 06: Meeting Lobby
- Meeting Title, Camera preview, Microphone toggle, Camera toggle. Join Button.

SCREEN 07: Active Video Meeting
- Participant Grid (showing synthetic names like "Alex Johnson", video state, mic state).
- Bottom Controls: Mic, Camera, Chat, Participants, Leave.
- Real-time connection states.

SCREEN 08: Meeting Chat
- Message list with synthetic names, Input field, Send button.

SCREEN 09: History
- Table/List of meetings (Date, Duration, Participants). Empty states included.

SCREEN 10: Ask Voom
- Search bar: "Search your organization's meeting knowledge."
- Example response layout (AI answers based on existing docs).

SCREEN 11: Organization Management
- Org profile, Member list, Role badges (Owner/Admin/Member).

SCREEN 12: Billing (Visual Only)
- Current plan, Usage, Entitlements. (No checkout forms, as Stripe is not configured).

# UX Details
* All screens must include proper Loading States (skeletons) and Empty States with clear explanations.
* Ensure responsive layouts for Desktop, Tablet, and Mobile.
* Maintain strict accessibility standards (contrast, focus).
