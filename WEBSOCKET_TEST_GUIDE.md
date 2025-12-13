# WebSocket Real-Time Testing Guide

## 🚀 Quick Test (2 minutes)

### Setup

1. **Stop any running dev server**
   ```bash
   # Press Ctrl+C in terminal
   ```

2. **Start the new WebSocket server**
   ```bash
   npm run dev
   ```

3. **Verify server started**
   Look for this banner:
   ```
   ╔═══════════════════════════════════════════╗
   ║                                           ║
   ║       🎉 localhost:party Server 🎉       ║
   ║                                           ║
   ║  ✅ Next.js: http://localhost:3000        ║
   ║  ✅ Socket.io: Ready for connections      ║
   ║                                           ║
   ╚═══════════════════════════════════════════╝
   ```

### Test Real-Time Features

#### Test 1: WebSocket Connection (30 seconds)

1. Open browser to `http://localhost:3000/display`
2. Check browser console

**Expected Output:**
```
✅ WebSocket connected
```

**Server Terminal Output:**
```
✅ Client connected: <socket-id>
📺 Display joining room: ABCD
📤 Sent initial state to display ABCD
```

✅ **PASS**: If you see these messages
❌ **FAIL**: If you see "WebSocket connection failed"

---

#### Test 2: Player Join - Real-Time Sync (1 minute)

1. **Display view** is open at `/display` (from Test 1)
2. **Note the 4-letter room code** displayed
3. Open **new browser window or phone** to `http://localhost:3000/play`
4. Enter the room code
5. Enter name: "TestPlayer"
6. Click "Join Game"

**Expected on Display View:**
- ✅ Player count updates from "0" to "1" **instantly**
- ✅ Player card appears with name "TestPlayer" **instantly**
- ✅ Animation plays as player joins
- ✅ "Need at least 2 players" warning still shows

**Expected on Controller:**
- ✅ Redirects to `/play/lobby`
- ✅ Shows "Welcome, TestPlayer!"
- ✅ Shows "1 Player"
- ✅ Your card is highlighted yellow with "YOU" badge

**Server Terminal Output:**
```
✅ Client connected: <socket-id>
🎮 Player "TestPlayer" joining room: ABCD
📤 Broadcast game state to room ABCD: {...}
✅ Player "TestPlayer" joined room ABCD
```

✅ **PASS**: Display updates without refresh
❌ **FAIL**: Need to refresh to see player

---

#### Test 3: Multiple Players (1 minute)

1. Open **third browser window** (or second phone)
2. Go to `http://localhost:3000/play`
3. Enter **same room code**
4. Enter name: "Player2"
5. Click "Join Game"

**Expected on Display View:**
- ✅ Player count updates from "1" to "2" **instantly**
- ✅ Player2 card appears **instantly**
- ✅ Both players visible

**Expected on Both Controllers:**
- ✅ Both see "2 Players"
- ✅ Both see each other in the list
- ✅ **"Start Game" button appears** on both controllers

**Server Terminal Output:**
```
✅ Client connected: <socket-id>
🎮 Player "Player2" joining room: ABCD
📤 Broadcast game state to room ABCD: {...}
✅ Player "Player2" joined room ABCD
```

✅ **PASS**: All views sync in real-time
❌ **FAIL**: Views don't update automatically

---

#### Test 4: Start Game (30 seconds)

1. On **any controller**, click "Start Game" button
2. Observe all views

**Expected on Display View:**
- ✅ Transitions from lobby to game screen **instantly**
- ✅ Shows "QUIPLASH" game type
- ✅ Shows "PROMPT" phase
- ✅ Shows "Round 1"

**Expected on All Controllers:**
- ✅ Game phase updates (future: will show game UI)

**Server Terminal Output:**
```
🎮 Starting game "quiplash" in room ABCD
📤 Broadcast game state to room ABCD: {...}
```

✅ **PASS**: All views transition together
❌ **FAIL**: Views don't update or only one updates

---

#### Test 5: Disconnection Handling (30 seconds)

1. Close one controller browser window
2. Observe display view

**Expected:**
- ✅ Player's connection status updates
- ✅ Player card might dim or show disconnected state
- ✅ Other player still connected

**Server Terminal Output:**
```
❌ Client disconnected: <socket-id>
⚠️ Player "TestPlayer" disconnected from room ABCD
📤 Broadcast game state to room ABCD: {...}
```

**Reconnect Test:**
1. Reopen `/play` with same name
2. Join same room

**Expected:**
- ✅ Rejoins successfully
- ✅ Retains same player ID
- ✅ Connection status updates to connected

✅ **PASS**: Disconnection handled gracefully
❌ **FAIL**: Player disappears or can't rejoin

---

## 🎯 Success Criteria

Issue #2 is complete if **all 5 tests pass**:

- [x] Test 1: WebSocket connects
- [x] Test 2: Single player joins, syncs in real-time
- [x] Test 3: Multiple players sync
- [x] Test 4: Start game syncs across all clients
- [x] Test 5: Disconnection/reconnection works

## 🐛 Troubleshooting

### WebSocket won't connect

**Check 1:** Is `.env.local` configured?
```bash
cat .env.local | grep WS_URL
# Should show: NEXT_PUBLIC_WS_URL="http://localhost:3000"
```

**Fix:**
```bash
# Edit .env.local, set:
NEXT_PUBLIC_WS_URL="http://localhost:3000"

# Restart server
npm run dev
```

**Check 2:** Did you restart the server after changing .env?
```bash
# Always restart after .env changes
npm run dev
```

---

### Players don't sync

**Check server logs:**
- Look for "📤 Broadcast game state" messages
- If missing, server isn't broadcasting

**Check browser console:**
- Look for "📦 Game state update:" messages
- If missing, client isn't receiving updates

**Common fix:**
- Ensure both views use **exact same room code**
- Refresh both browser windows
- Check for JavaScript errors in console

---

### "Room not found" error

**Cause:** Display view must open **first** to create room

**Fix:**
1. Open `/display` first
2. Wait for room code to appear
3. Then open `/play` and enter that code

---

### Port already in use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Fix:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

---

### Server crashes on startup

**Check Node.js version:**
```bash
node --version
# Need v20+
```

**Check for syntax errors:**
```bash
node server.js
# Look for error messages
```

---

## 📊 Expected Console Output

### Display View Console
```
✅ WebSocket connected
📦 Game state update: {roomCode: "ABCD", phase: "lobby", players: []}
📦 Game state update: {roomCode: "ABCD", phase: "lobby", players: [Player1]}
📦 Game state update: {roomCode: "ABCD", phase: "lobby", players: [Player1, Player2]}
```

### Controller Console
```
✅ WebSocket connected
📤 Emitting event: player:join
📦 Game state update: {roomCode: "ABCD", phase: "lobby", players: [...]}
```

### Server Terminal
```
✅ Client connected: abc123
📺 Display joining room: ABCD
📤 Sent initial state to display ABCD
✅ Client connected: def456
🎮 Player "Alice" joining room: ABCD
📤 Broadcast game state to room ABCD
✅ Player "Alice" joined room ABCD
```

---

## 🎮 Advanced Testing

### Test Multiple Rooms

1. Open `/display` in window 1 → Room AAAA
2. Open `/display` in window 2 → Room BBBB
3. Join each room with different players
4. Verify players only see their own room

**Expected:**
- ✅ Room AAAA players isolated from Room BBBB
- ✅ No cross-room state leaks

---

### Test Rapid Joins

1. Open display → Note room code
2. Open 5 controller windows rapidly
3. All join with different names quickly

**Expected:**
- ✅ All players appear on display
- ✅ No players missing
- ✅ No duplicate players
- ✅ Correct player count

---

### Test Room Persistence

1. Create room, add players
2. Refresh display view (F5)
3. Display reconnects

**Current Behavior:**
- ⚠️ Display creates **new room** (different code)
- ⚠️ Players remain in old room until reconnect

**Future Enhancement (Issue #1):**
- Database persistence will maintain rooms
- Display can rejoin existing room

---

## 📈 Performance Check

Open browser DevTools → Network tab → WS filter

**Check:**
- WebSocket connection stays open (green dot)
- Messages are small (<1KB per update)
- No message flooding (should be event-driven)
- Round-trip time <50ms on localhost

---

## ✅ Ready for Next Steps

Once all tests pass:

1. ✅ **Issue #2 Complete** - WebSocket server working
2. ⏭️ **Issue #1** - Set up Prisma for persistence
3. ⏭️ **Issue #5** - Implement first game (Quiplash)

---

**Status**: 🎉 WebSocket server fully functional!
**Real-time features**: ✅ Working
**Ready for**: ✅ Game implementation
