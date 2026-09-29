# Stitch to Voom Implementation Map

| Stitch Screen | Existing Route | Existing React Page | Existing Components | Existing API | Existing Context | Realtime |
|---------------|----------------|---------------------|---------------------|--------------|------------------|----------|
| 01 Landing Page | / | LandingPage.jsx | Header, Footer, Hero | None | AuthContext | No |
| 02 Login | /auth | Authentication.jsx| AuthForm, Button, Input | /api/v1/users/login | AuthContext | No |
| 03 Register | /auth | Authentication.jsx| AuthForm, Button, Input | /api/v1/users/register | AuthContext | No |
| 04 Dashboard | /home | home.jsx | MeetingCard, Sidebar, Stats | /api/v1/users/me | AuthContext, OrgContext | No |
| 05 Meeting List | /home | home.jsx | MeetingCard, Table | /api/v1/meetings | OrgContext | No |
| 06 Create Meeting | /home | home.jsx | CreateMeetingModal | POST /api/v1/meetings| OrgContext | No |
| 07 Meeting Lobby | /:url | VideoMeet.jsx | LobbyView, DeviceSelector | /api/v1/meetings/:meetingCode | AuthContext | No |
| 08 Active Video Meeting | /:url | VideoMeet.jsx | ParticipantGrid, BottomControls | /realtime-token | AuthContext | Yes |
| 09 Meeting Chat | /:url | VideoMeet.jsx | ChatPanel, MessageBubble | /api/v1/meetings/:code/messages| AuthContext | Yes |
| 10 History | /history | history.jsx | HistoryTable, MeetingCard | /get_all_activity | AuthContext | No |
| 11 Recording Details | /:url | VideoMeet.jsx | RecordingPlayer, DownloadBtn | /recordings | AuthContext | No |
| 12 Transcript | /:url | VideoMeet.jsx | TranscriptViewer | /transcript | AuthContext | No |
| 13 AI Intelligence | /:url | VideoMeet.jsx | AIInsightCard | /intelligence | AuthContext | No |
| 14 Ask Voom | /ask | AskVoom.jsx | SearchBar, AIResponse | /api/v1/organizations/:id/ask| OrgContext | No |
| 15 Workspace | /:url | VideoMeet.jsx | NotesEditor, Resources | /workspace | OrgContext | No |
| 16 Organization Mgt | /organization| OrganizationManagement.jsx| MemberTable, RoleSelect | /api/v1/organizations | OrgContext | No |
| 17 Billing | /organization| OrganizationManagement.jsx| BillingCard, UsageBars | /api/v1/billing/plan | OrgContext | No |
| 18 Profile / Settings | /home | home.jsx | ProfileForm, AvatarUpload | /api/v1/users/me | AuthContext | No |

