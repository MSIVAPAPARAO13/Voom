# Voom UI Current Problems

1. **Outdated Visual Design:** Generic layout that doesn't convey the premium "Meet. Collaborate. Remember." brand positioning.
2. **Inconsistent Component Usage:** Spacing, buttons, typography, and card designs vary significantly across routes (e.g. /home vs /history).
3. **Empty States missing or weak:** Blank screens appear on /history and /organization when no data is available rather than guiding the user to action.
4. **Poor Error States:** Unhandled API errors or raw JSON responses flash during failed meeting joins or incorrect credentials on /auth.
5. **No Loading Skeletons:** Relying heavily on generic spinners instead of content-aware loading skeletons for a smooth perceived performance.
6. **Raw Email Addresses & IDs:** Displaying MongoDB object IDs and raw user emails instead of formatted participant names and avatars.
7. **"Untitled Meeting" Clutter:** Users can create meetings without a proper title, leading to history clutter.
8. **Inadequate Meeting Controls:** The WebRTC screen share, mute, and camera toggles lack clear state visual indicators (e.g. red disabled state vs default).
9. **RAG/Ask Voom Presentation:** The /ask screen feels like a generic search box rather than an integrated AI memory assistant.
10. **Responsive Issues:** The active meeting view breaks on mobile devices (390x844), causing video streams to overflow horizontally.
11. **Billing UI Absent:** Although billing APIs exist in the backend (e.g., /api/v1/billing/plan), there is no robust frontend implementation reflecting them.
12. **Accessibility (a11y):** Keyboard navigation is trapped in the meeting lobby, and semantic HTML tags are missing on major sections.
