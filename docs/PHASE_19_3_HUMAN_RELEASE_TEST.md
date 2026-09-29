# Voom Phase 19.3 — Human Browser Release Test Checklist

This checklist is designed for a human developer to execute the final end-to-end release gate testing on a physical machine with a real browser, camera, and microphone.

------------------------------------------------------------
A. START SERVICES
------------------------------------------------------------
1. Start MongoDB/Atlas (Remote is configured in `.env`)
2. Start Redis (e.g. `redis-server` in the `Redis` folder)
3. Start backend: `npm run dev` in `ZBACKEND`
4. Start worker: `npm run worker` in `ZBACKEND`
5. Start frontend: `npm start` in `zfrontend`
6. Open http://localhost:3001 (or whatever port React starts on if 3000 is occupied)

------------------------------------------------------------
B. USER A
------------------------------------------------------------
1. Register a new user (e.g., `testA@voom.com`)
2. Login with the new credentials
3. Verify dashboard loads correctly
4. Verify organization is assigned or created
5. Create a new meeting and copy the join link/code

------------------------------------------------------------
C. USER B
------------------------------------------------------------
1. Open Chrome Incognito or Edge
2. Register User B (e.g., `testB@voom.com`)
3. Login
4. Join User A's meeting

------------------------------------------------------------
D. WEBRTC
------------------------------------------------------------
1. Allow camera permissions when prompted by browser
2. Allow microphone permissions when prompted by browser
3. Verify User A can see their own camera
4. Verify User B can see their own camera
5. Verify User A can hear User B's audio
6. Verify User B can hear User A's audio
7. Toggle camera (ON/OFF) and verify state changes remotely
8. Toggle microphone (ON/OFF) and verify state changes remotely
9. Screen share from User A to User B
10. Stop screen share
11. Leave meeting

------------------------------------------------------------
E. REALTIME
------------------------------------------------------------
1. Chat User A → User B
2. Chat User B → User A
3. Verify participant join/leave events update the participant list in realtime
4. Verify moderation controls (if Host mutes Participant)
5. Inspect WebSocket connection (Network Tab > WS) to ensure no reconnect loops

------------------------------------------------------------
F. RECORDING
------------------------------------------------------------
1. Start recording (as Host)
2. Speak to generate audio
3. Stop recording
4. Verify saved recording appears in the meeting summary or history
5. Verify playback of the recorded WebM blob

------------------------------------------------------------
G. HISTORY
------------------------------------------------------------
1. Open History tab
2. Verify the meeting is listed
3. Verify the recording is listed
4. Verify there are no duplicate entries
5. Verify search/filter functionality works

------------------------------------------------------------
H. TRANSCRIPTION
------------------------------------------------------------
1. Trigger transcription for the recorded meeting
2. Verify processing state via Socket events or UI polling
3. Verify transcript appears in the UI once completed
4. Verify transcript persists after a page refresh

------------------------------------------------------------
I. AI
------------------------------------------------------------
1. Generate meeting summary
2. Generate action items
3. Verify persistence (data is still there after page reload)

------------------------------------------------------------
J. ASK VOOM
------------------------------------------------------------
1. Open Ask Voom
2. Ask a question related to the transcribed meeting
3. Verify retrieval provides a relevant answer
4. Verify citation links back to the transcript timestamp
5. Verify organization isolation (User B cannot query User A's meetings if they are in different Orgs)

------------------------------------------------------------
K. SECURITY
------------------------------------------------------------
1. Logout
2. Try accessing a protected route (e.g. `/dashboard`) directly via URL
3. Verify authentication requirement forces a redirect to `/login`
4. Test User A vs User B isolation (tenant isolation)
5. Verify unauthorized meeting access is rejected (e.g. joining a private meeting without permission)

------------------------------------------------------------
L. BILLING
------------------------------------------------------------
*Note: Stripe TEST MODE is currently NOT CONFIGURED in the backend `.env`.*
1. Skip unless Stripe keys are added.

------------------------------------------------------------
M. RESPONSIVE
------------------------------------------------------------
Test UI scaling at:
- Desktop (1920x1080)
- Tablet (768px width)
- Mobile (390px width)
Check for layout overflow, hidden buttons, and accessible meeting controls.

------------------------------------------------------------
N. DEVTOOLS
------------------------------------------------------------
Open Console, Network, and WS tabs:
- Record any React/JS errors
- Record failed API requests (4xx/5xx)
- Note WebSocket and WebRTC errors
