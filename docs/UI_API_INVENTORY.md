# Voom UI API Inventory

| UI | Endpoint | Method | Request | Response | Auth | Organization Scope | Loading | Error | Empty |
|----|----------|--------|---------|----------|------|--------------------|---------|-------|-------|
| Login | /api/v1/users/login | POST | {email, password} | {token, user} | No | None | Yes | Yes | N/A |
| Register | /api/v1/users/register | POST | {name, email, password} | {token, user} | No | None | Yes | Yes | N/A |
| Dashboard | /api/v1/users/me | GET | None | {user} | Yes | None | Yes | Yes | N/A |
| Dashboard | /api/v1/users/get_all_activity | GET | None | [{activity}] | Yes | None | Yes | Yes | Yes |
| Create Meeting | /api/v1/meetings | POST | {title, description} | {meeting} | Yes | Context | Yes | Yes | N/A |
| Meeting Lobby | /api/v1/meetings/:meetingCode | GET | None | {meeting} | Opt | Opt | Yes | Yes | N/A |
| Active Meeting | /api/v1/meetings/:meetingCode/realtime-token | POST | None | {token} | Opt | Opt | Yes | Yes | N/A |
| Chat | /api/v1/meetings/:meetingCode/messages | GET/POST | {text} | [{message}] | Opt | Opt | Yes | Yes | Yes |
| Workspace | /api/v1/meetings/:meetingCode/workspace | GET | None | {notes, resources} | Opt | Opt | Yes | Yes | Yes |
| History | /api/v1/users/get_all_activity | GET | None | [{activity}] | Yes | None | Yes | Yes | Yes |
| Recording | /api/v1/meetings/:meetingCode/recordings | GET | None | [{recording}] | Opt | Opt | Yes | Yes | Yes |
| Transcript | /api/v1/meetings/:meetingCode/recordings/:id/transcript | GET | None | {transcript} | Opt | Opt | Yes | Yes | Yes |
| Ask Voom | /api/v1/organizations/:id/ask | POST | {query} | {answer, sources} | Yes | Required | Yes | Yes | Yes |
| Organization | /api/v1/organizations | GET | None | [{org}] | Yes | None | Yes | Yes | Yes |
| Billing | /api/v1/billing/plan | GET | None | {plan} | Yes | Required | Yes | Yes | N/A |

