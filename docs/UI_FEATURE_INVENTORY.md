# Voom UI Feature Inventory

| Feature | Frontend Route | Backend Endpoint | Method | Auth | Role | Data | Realtime | Status |
|---------|-----------------|------------------|--------|------|------|------|----------|--------|
| Authentication (Login) | /auth | /api/v1/users/login | POST | No | Any | User/Token | No | VERIFIED |
| Authentication (Register) | /auth | /api/v1/users/register | POST | No | Any | User/Token | No | VERIFIED |
| Dashboard / Home | /home | /api/v1/users/me | GET | Yes | Any | User | No | VERIFIED |
| Create Meeting | /home | /api/v1/meetings | POST | Yes | Any | Meeting | No | VERIFIED |
| Join Meeting | /:url | /api/v1/meetings/:meetingCode | GET | Opt | Any | Meeting | No | VERIFIED |
| Active Meeting | /:url | N/A | - | Opt | Any | WebRTC | Yes | VERIFIED |
| Chat | /:url | /api/v1/meetings/:meetingCode/messages | POST | Opt | Any | Message | Yes | VERIFIED |
| History | /history | /api/v1/users/get_all_activity | GET | Yes | Any | Activity | No | VERIFIED |
| Organization | /organization | /api/v1/organizations | GET | Yes | Any | Org | No | VERIFIED |
| Organization Members | /organization | /api/v1/organizations/:id/members | GET | Yes | Admin | Member | No | VERIFIED |
| Workspace / Notes | /:url | /api/v1/meetings/:meetingCode/workspace | GET | Opt | Any | Notes | No | VERIFIED |
| Recordings | /:url | /api/v1/meetings/:meetingCode/recordings | GET | Opt | Any | Rec | No | VERIFIED |
| Transcription | /:url | /api/v1/meetings/:meetingCode/recordings/:id/transcript | GET | Opt | Any | Transcript | No | VERIFIED |
| Ask Voom / RAG | /ask | /api/v1/organizations/:id/ask | POST | Yes | Any | AI | No | VERIFIED |
| Billing (Plan) | (None) | /api/v1/billing/plan | GET | Yes | Admin | Plan | No | Backend Only |
| Usage | (None) | /api/v1/billing/usage | GET | Yes | Admin | Usage | No | Backend Only |
