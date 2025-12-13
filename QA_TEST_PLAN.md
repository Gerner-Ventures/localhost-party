# QA Test Plan - Dual-View Architecture

## Test Environment Setup

### Prerequisites
- [ ] Development server running (`npm run dev`)
- [ ] Two devices available (computer + mobile, or two browser windows)
- [ ] `.env.local` configured with correct URLs
- [ ] Browser console open for debugging

### Device Setup
- **Device A (TV/Display)**: Large screen browser at `http://localhost:3000/display`
- **Device B (Controller)**: Mobile browser or responsive mode at `http://localhost:3000/play`

---

## 1. Display View Tests

### 1.1 Initial Load
- [ ] Navigate to `/display`
- [ ] **PASS**: Page loads without errors
- [ ] **PASS**: "localhost:party" title is visible
- [ ] **PASS**: "Connecting..." message appears briefly
- [ ] **PASS**: No console errors related to missing environment variables

### 1.2 Room Creation
- [ ] Room code appears automatically (4 uppercase letters)
- [ ] **PASS**: Room code is exactly 4 characters
- [ ] **PASS**: Room code contains only letters A-Z (no numbers)
- [ ] **PASS**: Room code does not contain I, O, or L (confusing letters)
- [ ] **PASS**: Same room code persists on page refresh (until server restart)

### 1.3 QR Code Display
- [ ] QR code is visible on screen
- [ ] **PASS**: QR code is rendered (white square with black pattern)
- [ ] **PASS**: QR code is centered and has white background
- [ ] **PASS**: Scanning QR code with phone camera shows a URL
- [ ] **PASS**: QR code URL format is `http://localhost:3000/play?code=XXXX`

### 1.4 Player List (Empty State)
- [ ] **PASS**: "Players (0)" is displayed
- [ ] **PASS**: "Waiting for players to join..." message is visible
- [ ] **PASS**: No start game instruction visible (needs 2+ players)

### 1.5 Visual Design
- [ ] **PASS**: Background has purple/blue gradient
- [ ] **PASS**: Text is large and readable from distance
- [ ] **PASS**: High contrast colors used throughout
- [ ] **PASS**: No scrollbars visible (full screen layout)

---

## 2. Controller View Tests

### 2.1 Join Screen Load
- [ ] Navigate to `/play` on mobile/second device
- [ ] **PASS**: Page loads without errors
- [ ] **PASS**: "localhost:party" title is visible
- [ ] **PASS**: Room Code and Your Name input fields are visible
- [ ] **PASS**: Join Game button is visible

### 2.2 Room Code Input Validation
- [ ] Click on Room Code field
- [ ] **PASS**: Keyboard appears (mobile) or field is focused
- [ ] **PASS**: Field prevents zoom on mobile devices
- [ ] Type lowercase letters (e.g., "test")
- [ ] **PASS**: Automatically converts to uppercase ("TEST")
- [ ] Type more than 4 characters (e.g., "ABCDEF")
- [ ] **PASS**: Truncates to 4 characters ("ABCD")
- [ ] **PASS**: Field is centered with large text

### 2.3 Player Name Input Validation
- [ ] Click on Your Name field
- [ ] Type a name (e.g., "Alice")
- [ ] **PASS**: Name appears in field
- [ ] Type 20 characters
- [ ] **PASS**: Character counter shows "20/20 characters"
- [ ] Try to type 21st character
- [ ] **PASS**: Does not allow more than 20 characters
- [ ] **PASS**: No zoom on input focus (mobile)

### 2.4 Join Button States
- [ ] With empty fields
- [ ] **PASS**: Join button is disabled (grayed out)
- [ ] Fill only room code
- [ ] **PASS**: Join button remains disabled
- [ ] Fill both room code and name
- [ ] **PASS**: Join button becomes enabled (bright yellow)
- [ ] **PASS**: Button text shows "Connecting..." or "Join Game" (depending on WebSocket state)

### 2.5 QR Code Join (Optional - if QR code works)
- [ ] Scan QR code from display view with mobile camera
- [ ] **PASS**: Opens `/play?code=XXXX` URL
- [ ] **PASS**: Room code field is pre-filled with correct code
- [ ] Enter name only
- [ ] **PASS**: Can join directly without typing room code

### 2.6 Invalid Room Code Handling
- [ ] Enter a non-existent room code (e.g., "FAKE")
- [ ] Enter your name
- [ ] Click Join Game
- [ ] **PASS**: Error message appears: "Could not join room..."
- [ ] **PASS**: User stays on join page
- [ ] **PASS**: Can try again with different code

---

## 3. API Endpoint Tests

### 3.1 Room Creation Endpoint
- [ ] Open browser DevTools Network tab
- [ ] Navigate to `/display`
- [ ] **PASS**: POST request to `/api/rooms/create` succeeds (200 status)
- [ ] **PASS**: Response contains `code` and `id` fields
- [ ] **PASS**: Code is 4 uppercase letters

### 3.2 Room Validation Endpoint
- [ ] On `/play`, enter the room code from display view
- [ ] Enter name and click Join
- [ ] Check Network tab
- [ ] **PASS**: GET request to `/api/rooms/[CODE]` succeeds (200 status)
- [ ] Try with invalid code "FAKE"
- [ ] **PASS**: GET request to `/api/rooms/FAKE` fails (404 status)

---

## 4. Player Lobby Tests

### 4.1 Successful Join (Single Player)
- [ ] On controller, enter valid room code and name
- [ ] Click Join Game
- [ ] **PASS**: Redirects to `/play/lobby?code=XXXX`
- [ ] **PASS**: "Room XXXX" title is visible
- [ ] **PASS**: "Welcome, [YourName]!" message appears
- [ ] **PASS**: Player count shows "1 Player"
- [ ] **PASS**: Your player card is highlighted (yellow background)
- [ ] **PASS**: "YOU" badge appears on your card
- [ ] **PASS**: Warning message: "Waiting for more players - Need at least 2"
- [ ] **PASS**: Start Game button is not visible yet

### 4.2 LocalStorage Persistence
- [ ] Join a room with name "Alice"
- [ ] Close browser tab
- [ ] Navigate to `/play` again
- [ ] **PASS**: Name field is pre-filled with "Alice"
- [ ] **PASS**: Can use same name or change it

### 4.3 Visual Design (Controller)
- [ ] **PASS**: Purple gradient background
- [ ] **PASS**: Large, touch-friendly buttons
- [ ] **PASS**: Clear visual hierarchy
- [ ] **PASS**: Smooth transitions and animations

---

## 5. Multi-Player Tests (Requires WebSocket Server)

### ⚠️ Note: These tests will FAIL until Issue #2 (WebSocket Server) is implemented

### 5.1 Second Player Joins
- [ ] Open second mobile device or browser window
- [ ] Navigate to `/play` and enter same room code
- [ ] Enter different name (e.g., "Bob")
- [ ] Click Join Game
- [ ] **EXPECTED**: Both display and controller views update in real-time
- [ ] **EXPECTED**: Display view shows "Players (2)"
- [ ] **EXPECTED**: Both players visible on display view
- [ ] **EXPECTED**: Controller lobby shows both players
- [ ] **EXPECTED**: "Start Game" button appears on all controllers

### 5.2 Real-Time Updates
- [ ] Third player joins
- [ ] **EXPECTED**: All views update automatically
- [ ] **EXPECTED**: Player count increments
- [ ] **EXPECTED**: New player appears in list with animation

### 5.3 Player Emojis
- [ ] Check player cards on display view
- [ ] **EXPECTED**: Each player has different emoji (🎮, 🎯, 🎲, etc.)
- [ ] **EXPECTED**: Emojis cycle through 8 options

### 5.4 Start Game Button
- [ ] With 2+ players, click "Start Game" on any controller
- [ ] **EXPECTED**: Game starts for all players
- [ ] **EXPECTED**: All views transition to game phase

---

## 6. Responsive Design Tests

### 6.1 Display View - Large Screens
- [ ] Test on 1920x1080 resolution
- [ ] **PASS**: All content is visible without scrolling
- [ ] **PASS**: Text is readable from 10+ feet
- [ ] Test on 4K resolution (3840x2160)
- [ ] **PASS**: Layout scales appropriately
- [ ] **PASS**: No pixelation or blurriness

### 6.2 Display View - Tablet/Medium Screens
- [ ] Resize browser to 1024x768
- [ ] **PASS**: Layout adjusts gracefully
- [ ] **PASS**: QR code remains visible
- [ ] **PASS**: Player grid adjusts column count

### 6.3 Controller View - Mobile Devices
- [ ] Test on iPhone (375x667)
- [ ] **PASS**: All inputs are tappable
- [ ] **PASS**: No horizontal scrolling
- [ ] **PASS**: Join button is always visible
- [ ] Test on Android (412x915)
- [ ] **PASS**: Layout is consistent
- [ ] **PASS**: Inputs work correctly

### 6.4 Controller View - Landscape Orientation
- [ ] Rotate mobile device to landscape
- [ ] **PASS**: Layout adapts to landscape
- [ ] **PASS**: All elements remain accessible

---

## 7. Error Handling & Edge Cases

### 7.1 No Internet Connection
- [ ] Disconnect from network
- [ ] Try to load `/display`
- [ ] **PASS**: Error page or offline message appears
- [ ] **PASS**: No JavaScript errors in console

### 7.2 WebSocket Connection Issues
- [ ] Check browser console on `/display`
- [ ] **EXPECTED**: "WebSocket connected" or connection attempt messages
- [ ] **EXPECTED**: "Socket not connected" warnings if no server
- [ ] **PASS**: App doesn't crash, shows appropriate state

### 7.3 Invalid URL Parameters
- [ ] Navigate to `/play?code=TOOLONG`
- [ ] **PASS**: Code field shows only first 4 chars or empty
- [ ] Navigate to `/play/lobby` without code parameter
- [ ] **PASS**: Redirects to `/play` or shows error

### 7.4 Special Characters in Name
- [ ] Try entering name with emojis: "Alice 🎮"
- [ ] **PASS**: Emojis are accepted or handled gracefully
- [ ] Try entering HTML: "<script>alert('hi')</script>"
- [ ] **PASS**: Rendered as plain text, not executed

### 7.5 Rapid Input Changes
- [ ] Quickly type and delete in room code field
- [ ] **PASS**: Input remains responsive
- [ ] **PASS**: No errors in console

### 7.6 Browser Back Button
- [ ] Join a room successfully
- [ ] Click browser back button
- [ ] **PASS**: Returns to `/play`
- [ ] **PASS**: Can join a different room

### 7.7 Page Refresh in Lobby
- [ ] Join a room and reach lobby
- [ ] Refresh the page (F5 or Cmd+R)
- [ ] **EXPECTED** (with WebSocket server): Rejoins room automatically
- [ ] **CURRENT**: Returns to join page (acceptable without server)

---

## 8. Browser Compatibility Tests

### 8.1 Chrome/Edge
- [ ] Test on Chrome (latest version)
- [ ] **PASS**: All features work
- [ ] **PASS**: Animations are smooth

### 8.2 Safari (Desktop & iOS)
- [ ] Test on Safari browser
- [ ] **PASS**: Gradients render correctly
- [ ] **PASS**: Inputs work without zoom issues
- [ ] **PASS**: QR code displays properly

### 8.3 Firefox
- [ ] Test on Firefox browser
- [ ] **PASS**: Layout is consistent
- [ ] **PASS**: No rendering issues

### 8.4 Mobile Browsers
- [ ] Test on Mobile Safari (iOS)
- [ ] **PASS**: Touch targets are large enough
- [ ] **PASS**: No viewport zoom on input
- [ ] Test on Chrome Mobile (Android)
- [ ] **PASS**: Consistent experience

---

## 9. Performance Tests

### 9.1 Page Load Speed
- [ ] Open DevTools Performance tab
- [ ] Navigate to `/display`
- [ ] **PASS**: Page loads in < 2 seconds
- [ ] **PASS**: No layout shifts (CLS)

### 9.2 Animation Performance
- [ ] Check FPS during player join animations
- [ ] **PASS**: Animations run at 60fps
- [ ] **PASS**: No jank or stuttering

### 9.3 Memory Usage
- [ ] Open browser task manager
- [ ] Keep `/display` open for 5 minutes
- [ ] **PASS**: Memory usage remains stable
- [ ] **PASS**: No memory leaks

---

## 10. Accessibility Tests

### 10.1 Keyboard Navigation
- [ ] Tab through join form
- [ ] **PASS**: Focus order is logical
- [ ] **PASS**: Focus indicators are visible
- [ ] Press Enter on Join button
- [ ] **PASS**: Form submits

### 10.2 Screen Reader Support
- [ ] Use screen reader (VoiceOver/NVDA)
- [ ] **PASS**: Input labels are announced
- [ ] **PASS**: Button states are announced
- [ ] **IMPROVEMENT NEEDED**: Add ARIA labels (noted in implementation)

### 10.3 Color Contrast
- [ ] Use browser DevTools Accessibility tab
- [ ] **PASS**: Text meets WCAG AA standards
- [ ] **PASS**: Buttons have sufficient contrast

---

## 11. Build & Production Tests

### 11.1 Production Build
```bash
npm run build
```
- [ ] **PASS**: Build completes without errors
- [ ] **PASS**: No TypeScript errors
- [ ] **PASS**: No warnings (except known Prisma version warning)

### 11.2 Production Server
```bash
npm run start
```
- [ ] Navigate to `http://localhost:3000/display`
- [ ] **PASS**: Production build works identically to dev

### 11.3 Bundle Size
- [ ] Check `.next/` folder after build
- [ ] **PASS**: Display and controller routes are code-split
- [ ] **PASS**: No single bundle > 500KB

---

## Test Results Summary

### Critical Tests (Must Pass)
- [ ] Display view loads and shows room code
- [ ] Controller can join room (API call succeeds)
- [ ] Form validation works correctly
- [ ] Responsive design works on mobile and desktop
- [ ] Production build succeeds

### Important Tests (Should Pass)
- [ ] QR code generates correctly
- [ ] LocalStorage persists player name
- [ ] Error messages display for invalid codes
- [ ] Visual design matches requirements
- [ ] Browser compatibility across major browsers

### Future Tests (Require WebSocket Server)
- [ ] Real-time player synchronization
- [ ] Multiple players in same room
- [ ] Start game functionality
- [ ] Disconnection handling
- [ ] Game state updates

---

## Bug Tracking Template

When you find a bug, document it like this:

**Bug #**: [Number]
**Severity**: Critical / High / Medium / Low
**Test Section**: [e.g., 2.2 Room Code Input Validation]
**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected**: [What should happen]
**Actual**: [What actually happened]
**Browser/Device**: [e.g., Chrome 120 on Windows]
**Screenshots**: [If applicable]

---

## Sign-Off Checklist

Before marking Issue #3 as complete:

- [ ] All critical tests pass
- [ ] At least 90% of important tests pass
- [ ] Known issues are documented
- [ ] README reflects actual functionality
- [ ] Code is committed to version control
- [ ] Team has reviewed the implementation

**Tested By**: _________________
**Date**: _________________
**Sign-Off**: _________________

---

## Notes

- WebSocket server tests are expected to fail until Issue #2 is complete
- Prisma database tests require Issue #1 to be complete
- Some accessibility improvements are noted for future enhancement
- Performance metrics may vary based on development machine
