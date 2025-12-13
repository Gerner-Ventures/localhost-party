# Quick QA Checklist

## 🚀 Setup (30 seconds)
- [ ] `npm run dev` running
- [ ] Browser on `localhost:3000/display`
- [ ] Phone/2nd browser on `localhost:3000/play`

## 📺 Display View (2 minutes)
- [ ] Loads without errors
- [ ] Shows 4-letter room code (no I/O/L)
- [ ] QR code visible
- [ ] "Players (0)" shown
- [ ] Purple/blue gradient background
- [ ] No scrollbars

## 📱 Controller View (3 minutes)
- [ ] Loads without errors
- [ ] Room code auto-capitalizes
- [ ] Room code max 4 chars
- [ ] Name max 20 chars (counter shows)
- [ ] Join button disabled when empty
- [ ] Join button enabled when filled
- [ ] QR code opens correct URL with code pre-filled

## 🔌 API Tests (1 minute)
- [ ] POST `/api/rooms/create` returns 200 + code
- [ ] GET `/api/rooms/[validCode]` returns 200
- [ ] GET `/api/rooms/FAKE` returns 404

## 🎮 Join Flow (2 minutes)
- [ ] Enter valid room code + name on controller
- [ ] Click Join → redirects to `/play/lobby`
- [ ] Shows "Welcome, [Name]!"
- [ ] Shows "1 Player"
- [ ] Your card highlighted yellow with "YOU" badge
- [ ] Shows "Need at least 2 players" warning
- [ ] No Start Game button (< 2 players)

## 🔄 State Tests (2 minutes)
- [ ] Name saves to localStorage
- [ ] Close/reopen `/play` → name pre-filled
- [ ] Invalid room code shows error
- [ ] Error lets you try again

## 📱 Responsive (2 minutes)
- [ ] Mobile (375px): No horizontal scroll, buttons tappable
- [ ] Tablet (768px): Layout adjusts
- [ ] Desktop (1920px): Readable from distance
- [ ] Landscape: Works correctly

## 🏗️ Build (1 minute)
```bash
npm run build
```
- [ ] Completes successfully
- [ ] No TypeScript errors
- [ ] Only Prisma version warnings (expected)

## ⚠️ Expected Failures (No WebSocket Server Yet)
- ❌ Players don't sync between views
- ❌ Display doesn't update when player joins
- ❌ Start Game button doesn't work
- ❌ Real-time updates don't happen

**These are EXPECTED until Issue #2 (WebSocket Server) is implemented!**

---

## ✅ Quick Pass Criteria

If these all pass, Issue #3 is complete:

1. ✅ Both views load without errors
2. ✅ Room codes generate (4 chars, no I/O/L)
3. ✅ QR codes work
4. ✅ Join form validation works
5. ✅ Can navigate to lobby (even if players don't sync)
6. ✅ Mobile responsive
7. ✅ Production build succeeds

**Total Test Time**: ~15 minutes

---

## 🐛 Common Issues to Check

| Issue | Check | Fix |
|-------|-------|-----|
| CORS errors | Browser console | Check `NEXT_PUBLIC_WS_URL` in `.env.local` |
| QR code missing | Network tab | Ensure `qrcode.react` installed |
| Room code not found | API response | Check if room exists in store |
| Layout broken on mobile | DevTools responsive mode | Check viewport meta tag |
| TypeScript errors | Terminal | Run `npm run build` to see all errors |
| White screen | Browser console | Check for uncaught errors |

---

## 📊 Test Results Template

**Date**: __________
**Tested By**: __________
**Branch**: __________

### Results
- Display View: ✅ / ❌
- Controller View: ✅ / ❌
- API Endpoints: ✅ / ❌
- Join Flow: ✅ / ❌
- Responsive: ✅ / ❌
- Build: ✅ / ❌

### Bugs Found
1. ___________________________
2. ___________________________

### Overall Status
- [ ] **PASS** - Ready for merge
- [ ] **PASS WITH NOTES** - Minor issues documented
- [ ] **FAIL** - Blocking issues found

**Notes**:
_________________________________
_________________________________
