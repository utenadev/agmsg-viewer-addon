# agmsg-viewer-addon

[日本語版はこちら](README-ja.md)

**agmsg-viewer, inside the agmsg app.** An add-on pane for the
[agmsg](https://github.com/fujibee/agmsg) desktop app (0.6.0+) that shows the
selected team's conversation as a LINE-style chat timeline — by
[utenadev](https://github.com/utenadev), author of the standalone
[agmsg-viewer](https://github.com/utenadev/agmsg-viewer).

The standalone viewer reads agmsg's SQLite database with a Go binary. This
add-on brings the same reading experience into the app itself: it runs in the
app's sandboxed add-on pane and receives only the messages the user grants it.
No database access, no program execution, no operating agmsg.

## What it looks like

Picture the standalone viewer's chat screen, shrunk into one app pane:

- A white toolbar on top: the team name, a message count, **↑ Top / ↓ Bottom**
  jump buttons, a search box, and a sender filter dropdown.
- Below it, the familiar slate-blue (`#7493c0`) chat background. Messages run
  oldest-to-newest, grouped under rounded day pills ("Today", "Yesterday", or
  a date).
- The **first speaker** of the loaded window sits on the **right**, in the
  yellow-green (`#85e249`) bubble — the agmsg-viewer convention. Everyone else
  sits on the **left**, each agent with its own pastel bubble color and a
  round avatar showing its initial in a per-agent color. The recipient
  (`→ name`) and the time (hover for the full timestamp) sit next to each
  bubble.
- Long agent reports are folded with a fade and a **"Show all (N chars)"**
  button, so one report cannot bury the conversation.
- Status words get **auto-stamps**, LINE-style: a message containing
  `CLEARED` earns a `✅ CLEARED` stamp chip, `BLOCKED` earns `🧱 BLOCKED`,
  and a Japanese "お疲れさま" earns `🍵`. Half joke, half status scanner —
  you can spot how the work ended while scrolling.

## Features

- **LINE-style bubbles** with the standalone viewer's alignment and coloring
  rules (first speaker right / green, others left / per-agent pastel).
- **Live updates**: new messages appear as the app delivers them; the view
  sticks to the bottom only while you are already there.
- **Keyword search and sender filter**, applied instantly, with a
  "showing N" count.
- **Day separators** and full timestamps on hover.
- **Long-message folding** (over 360 characters or 8 lines).
- **Auto-stamps** for `CLEARED` / `BLOCKED` / おつかれさま.
- Light and dark mode follow the system, like the sample add-on.

## Install

1. In the agmsg app, open **Settings → Add-ons → Install from GitHub**.
2. Enter `utenadev/agmsg-viewer-addon` and press **Install…**.
3. Review the permission it asks for (read the team's messages) and confirm.
4. Press the **+** at the top of the panes and choose **Add-on pane ▸ Chat
   viewer**. The first time, allow it to read the current team's messages.

## Permissions

| Permission | Why |
| --- | --- |
| `messages:read` | The only one. Shows the selected team's conversation as a chat timeline with per-agent colors, keyword/sender filters, and long-message folding. |

No `files:read`, no `git:read`, no `network`. The pane stores nothing (the
sandbox has no storage anyway); search text and filters live only while the
pane is open.

## Limits

- The app hands a pane only the **newest 500 messages**, so on a busy team
  the timeline starts mid-conversation — and "first speaker" means the first
  speaker of that loaded window, exactly like the standalone viewer's tail
  view.
- This is a viewer: it cannot send messages or operate agmsg, by design of
  the add-on sandbox.

## Development

No build step — `app-panes/chat-viewer/web/` is exactly what the app installs.

```bash
# Preview in a plain browser (the kit serves sample data after ~1 second):
python3 -m http.server 8000 -d app-panes/chat-viewer/web
# → http://localhost:8000

# Check the repository the way the app checks an install:
node kit/agmsg-addon-check.cjs
```

To try it in the app while developing: **Settings → Add-ons → Developer →
Load from folder…**, pick this repository, then open the pane from the **+**
menu.

`kit/` is copied from the agmsg app (`app/addon-kit/`), via
[fujibee/agmsg-addon-sample](https://github.com/fujibee/agmsg-addon-sample);
copy a newer kit from there rather than editing these files.

## License

MIT — see [LICENSE](LICENSE). The add-on kit (`kit/`, and
`app-panes/chat-viewer/web/agmsg-addon.js`) is from the agmsg project,
also MIT.
