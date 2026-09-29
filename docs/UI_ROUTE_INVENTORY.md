# Voom UI Route Inventory

| Route | Purpose | Authentication | Role | Page/Component | API Calls | Realtime | Loading | Empty | Error |
|-------|---------|----------------|------|----------------|-----------|----------|---------|-------|-------|
| / | Landing Page | No | Any | LandingPage | None | No | No | No | No |
| /auth | Login/Register | No | Any | Authentication | /login, /register | No | Yes | No | Yes |
| /home | User Dashboard | Yes | Any | HomeComponent | /me, /meetings | No | Yes | Yes | Yes |
| /history | Meeting History | Yes | Any | History | /get_all_activity | No | Yes | Yes | Yes |
| /organization | Manage Organization | Yes | Any/Admin | OrganizationManagement | /organizations, /members | No | Yes | Yes | Yes |
| /ask | AI Knowledge Search | Yes | Any | AskVoom | /ask | No | Yes | Yes | Yes |
| /:url | Active Meeting | Opt | Any | VideoMeetComponent | /realtime-token, /messages, /recordings | Yes | Yes | No | Yes |

