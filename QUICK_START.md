# Quick Start Guide

## 🚀 Get Started in 2 Minutes

### 1. Stop the Dev Server (if running)

```bash
# Press Ctrl+C in your terminal
```

### 2. Restart the Dev Server

```bash
npm run dev
```

> **Why restart?** Environment variables are cached. Restarting loads the updated config with WebSocket disabled.

### 3. Test the App

**Open Display View (TV/Large Screen):**
```
http://localhost:3000/display
```

**Expected:**
- ✅ See room code (4 letters)
- ✅ See QR code
- ✅ NO WebSocket errors
- ✅ Clean console

**Open Controller View (Mobile/Phone):**
```
http://localhost:3000/play
```

**Expected:**
- ✅ Enter room code from display
- ✅ Enter your name
- ✅ Join room successfully
- ✅ See lobby page
- ✅ NO WebSocket errors

## ✅ Success Checklist

After restarting the dev server, verify:

- [ ] No `WebSocket connection failed` errors in console
- [ ] Display view shows room code and QR code
- [ ] Controller can join and navigate to lobby
- [ ] Console is clean (no red errors)

If you see "WebSocket server not available" warnings, that's fine - those are intentional and only appear once.

## 🎮 What You Can Test Now

### Without WebSocket Server

✅ **Working Features:**
- Display view loads with room code
- QR code generation
- Room creation API
- Controller join flow
- Form validation
- Navigation to lobby
- Mobile responsive design
- All UI components

❌ **Not Working (Expected):**
- Players don't sync between devices
- Real-time updates
- Start game functionality
- Game state synchronization

### Testing Workflow

1. **Display** → Creates room → Shows code
2. **Controller** → Enters code → Joins room → Sees lobby
3. **Both views work independently** ✅
4. **Real-time sync doesn't work yet** (Issue #2) ❌

## 🔧 Configuration

### Current Setup (Default)

```bash
# .env.local
NEXT_PUBLIC_WS_URL=""  # ← WebSocket DISABLED
```

**Result:** No WebSocket errors, UI works for testing

### When You Implement Issue #2

```bash
# .env.local
NEXT_PUBLIC_WS_URL="http://localhost:3000"  # ← WebSocket ENABLED
```

**Result:** Real-time features work

## 🐛 Troubleshooting

### Still seeing WebSocket errors?

**1. Restart dev server**
```bash
# Ctrl+C to stop
npm run dev
```

**2. Check environment variable**
```bash
# Should show empty string
echo $NEXT_PUBLIC_WS_URL
```

**3. Hard refresh browser**
```
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

**4. Verify .env.local**
```bash
cat .env.local | grep WS_URL
# Should show: NEXT_PUBLIC_WS_URL=""
```

### Room not found error?

Make sure display view is open FIRST (it creates the room).

### QR code not working?

- Try zooming in on the QR code
- Ensure good lighting
- Move phone closer to screen
- Or manually type the room code instead

## 📝 Test Script

Copy and run this exact sequence:

```bash
# 1. Stop server
# Press Ctrl+C

# 2. Start server
npm run dev

# 3. Wait for "Ready" message

# 4. Open in browser
open http://localhost:3000/display

# 5. Note the room code (4 letters)

# 6. Open controller (phone or new window)
open http://localhost:3000/play

# 7. Enter room code and name "TestUser"

# 8. Click "Join Game"

# 9. Should see lobby with "Welcome, TestUser!"

# ✅ Success!
```

## 📚 Documentation

- **Full Test Plan**: See `QA_TEST_PLAN.md`
- **Quick Tests**: See `QA_QUICK_CHECKLIST.md`
- **Manual Script**: See `MANUAL_TEST_SCRIPT.md`
- **WebSocket Info**: See `WEBSOCKET_STATUS.md`
- **Implementation Details**: See `IMPLEMENTATION_NOTES.md`

## 🎯 Next Steps

After testing the UI:

1. ✅ **Issue #3 Complete** - Dual-view architecture working
2. ⏭️ **Start Issue #2** - Implement WebSocket server
3. ⏭️ **Then Issue #1** - Set up Prisma database
4. ⏭️ **Then Issue #5** - Build first game (Quiplash)

## 💡 Tips

- **Work on UI**: WebSocket disabled = clean console for UI work
- **Work on real-time**: Enable WebSocket when implementing Issue #2
- **Testing layouts**: Current setup is perfect - no errors, fast reloads
- **Mobile testing**: Use ngrok or similar to test on real mobile devices

---

**Status**: ✅ UI fully functional without WebSocket
**Console**: ✅ Clean (no errors)
**Ready for**: ✅ UI testing, responsive design, API testing
**Not ready for**: ❌ Real-time multiplayer (needs Issue #2)

**Enjoy building! 🚀**
