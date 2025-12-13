# Manual Test Script - 5 Minute Smoke Test

Follow these steps exactly to verify the dual-view implementation works.

## Setup (30 seconds)

1. Open Terminal in project directory
2. Run: `npm run dev`
3. Wait for "Ready" message
4. Keep terminal open

## Test 1: Display View (1 minute)

### Steps:
1. Open Chrome browser
2. Navigate to: `http://localhost:3000/display`
3. Wait 2 seconds

### Expected Results:
✅ Page loads completely
✅ See large text: "localhost:party"
✅ See text: "Room Code" followed by 4 letters (example: "ABCD")
✅ See white square QR code
✅ See text: "Join at http://localhost:3000/play"
✅ See "Players (0)"
✅ See "Waiting for players to join..."
✅ Purple/blue gradient background

### Screenshot Location:
- Room code: CENTER TOP of screen (huge letters)
- QR code: CENTER of screen (white square)

### Write down the room code you see: __________

**STOP**: If display view doesn't load, check terminal for errors.

---

## Test 2: Controller Join (2 minutes)

### Steps:
1. Open your phone's browser OR open new Chrome window
2. Navigate to: `http://localhost:3000/play`
3. In "Room Code" field, type the code from Test 1
4. In "Your Name" field, type: "TestUser"
5. Click big yellow "Join Game" button

### Expected Results:

**Before clicking Join:**
✅ Room code converts to UPPERCASE as you type
✅ Room code stops at 4 characters (can't type 5th)
✅ Character counter shows: "8/20 characters" under name field
✅ Join button is bright yellow (not grayed out)

**After clicking Join:**
✅ Page changes to `/play/lobby?code=XXXX`
✅ See text: "Room XXXX" (your code)
✅ See text: "Welcome, TestUser!"
✅ See text: "1 Player"
✅ See yellow card with "TestUser" and "YOU" badge
✅ See warning: "Waiting for more players"
✅ NO "Start Game" button visible (need 2 players)

**STOP**: If you see "Could not join room", the room wasn't created properly.

---

## Test 3: Invalid Room Code (30 seconds)

### Steps:
1. Go back to `/play` (use browser back button)
2. In "Room Code" field, type: "FAKE"
3. In "Your Name" field, type: "Test"
4. Click "Join Game"

### Expected Results:
✅ Error message appears (red box)
✅ Error says: "Could not join room..."
✅ Stays on `/play` page (doesn't navigate away)
✅ Can try again with different code

---

## Test 4: QR Code (1 minute)

### Steps:
1. Go back to display view: `http://localhost:3000/display`
2. Pull out your phone
3. Open Camera app
4. Point at QR code on screen
5. Tap the notification/link that appears

### Expected Results:
✅ Phone browser opens
✅ URL is: `http://localhost:3000/play?code=XXXX`
✅ Room code field is already filled in
✅ Only need to enter name

**NOTE**: If QR code doesn't scan, it might be:
- Too small on screen (zoom in browser)
- Camera needs better lighting
- Need to be closer to screen

---

## Test 5: LocalStorage (30 seconds)

### Steps:
1. On controller view, join a room with name: "Alice"
2. Close the browser tab completely
3. Open new tab to: `http://localhost:3000/play`

### Expected Results:
✅ "Your Name" field is pre-filled with "Alice"
✅ Can change name or keep it
✅ Room code field is empty (correct behavior)

---

## Test 6: API Endpoints (30 seconds)

### Steps:
1. Open browser DevTools (F12)
2. Go to Network tab
3. Navigate to: `http://localhost:3000/display`
4. Look for request to `/api/rooms/create`

### Expected Results:
✅ POST request to `/api/rooms/create` shows Status 200
✅ Response tab shows: `{"code":"XXXX","id":"..."}`
✅ No 404 or 500 errors

---

## Test 7: Responsive Design (1 minute)

### Steps:
1. On controller view: `http://localhost:3000/play`
2. Open DevTools (F12)
3. Click device toolbar icon (phone icon) or press Ctrl+Shift+M
4. Select "iPhone 12 Pro" from device dropdown
5. Try using the form

### Expected Results:
✅ Form looks good on mobile size
✅ Inputs are large and tappable
✅ No horizontal scrolling
✅ Join button is visible without scrolling
✅ Text is readable

---

## Test 8: Production Build (1 minute)

### Steps:
1. Stop dev server (Ctrl+C in terminal)
2. Run: `npm run build`
3. Wait for build to complete

### Expected Results:
✅ Build completes successfully
✅ See: "Compiled successfully"
✅ See route list with `/display` and `/play`
✅ No red errors (yellow warnings about Prisma are OK)

**Don't run `npm start` yet - dev server is fine for now**

---

## ✅ Final Checklist

After completing all tests, check these:

- [ ] Display view loads and shows room code
- [ ] QR code is visible
- [ ] Controller can join with valid code
- [ ] Invalid code shows error message
- [ ] Join redirects to lobby page
- [ ] LocalStorage saves player name
- [ ] Mobile view looks good
- [ ] Production build succeeds

**If all checked**: ✅ **IMPLEMENTATION IS WORKING!**

---

## 🐛 Troubleshooting

### "Cannot GET /display"
- Check URL: Must be `/display` not `/display/`
- Restart dev server

### "Could not join room"
- Make sure display view is open (creates the room)
- Use exact room code (case-sensitive)
- Check terminal for API errors

### QR code not visible
- Check browser console for errors
- Verify `qrcode.react` is installed: `npm list qrcode.react`

### "WebSocket not connected" in console
- **This is expected** - WebSocket server not implemented yet (Issue #2)
- App will still work for basic testing

### TypeScript errors during build
- Run: `npm run build` to see full error list
- Check file paths and imports

### LocalStorage not persisting
- Check browser privacy settings
- Try different browser
- Clear cache and try again

---

## 📝 Test Report

**Date**: __________
**Tester**: __________

**Test Results**:
- Test 1 (Display View): ✅ / ❌
- Test 2 (Controller Join): ✅ / ❌
- Test 3 (Invalid Code): ✅ / ❌
- Test 4 (QR Code): ✅ / ❌
- Test 5 (LocalStorage): ✅ / ❌
- Test 6 (API): ✅ / ❌
- Test 7 (Responsive): ✅ / ❌
- Test 8 (Build): ✅ / ❌

**Issues Found**:
_________________________________
_________________________________

**Overall**: ✅ PASS / ❌ FAIL

---

## 🎯 Success Criteria

To mark Issue #3 as complete, you need:

- ✅ At least 7/8 tests passing
- ✅ No critical bugs
- ✅ Production build succeeds

**Minor issues can be documented and fixed in follow-up PRs.**

---

## Next Steps

After passing these tests:

1. **Commit your changes**: `git add . && git commit -m "Implement dual-view architecture (Issue #3)"`
2. **Push to GitHub**: `git push origin main`
3. **Update Issue #3**: Comment with test results
4. **Start Issue #2**: WebSocket server implementation (this will make real-time features work)

**Good luck! 🚀**
