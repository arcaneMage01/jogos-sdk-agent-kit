# Publishing a game through the Jogos MCP server

The SDK kit gets a game **running** on the platform SDK. This document covers the other half:
**getting the build onto the store** through the Jogos MCP server.

The MCP server wraps the developer console workflow end to end:
create a draft → upload build + covers → pass the self-test gate → submit for review.

> Pre-release endpoint: `https://www.jogospre.com/api/mcp`
> The production endpoint is served from the production developer host; confirm the host before you
> hard-code it anywhere.

---

## 1. Connect

The server speaks **Streamable HTTP** and requires **OAuth 2.1** (authorization code + PKCE S256,
public client, dynamic client registration).

```json
{
  "mcpServers": {
    "jogosPre": {
      "url": "https://www.jogospre.com/api/mcp"
    }
  }
}
```

| Client | How |
|---|---|
| Claude Code | `claude mcp add --transport http --scope user jogosPre https://www.jogospre.com/api/mcp` then `/mcp` → Authenticate |
| Trae / Cursor / VS Code | add the JSON above, then click Authorize in the MCP panel |
| Raw HTTP | `POST` JSON-RPC with `Authorization: Bearer <access_token>` |

Scopes: `games:read`, `games:write`, `games:publish`.

### Discovery endpoints (verified)

| URL | Status |
|---|---|
| `https://www.jogospre.com/api/.well-known/oauth-protected-resource` | 200 JSON |
| `https://www.jogospre.com/api/.well-known/oauth-authorization-server` | 200 JSON |
| `https://www.jogospre.com/api/mcp/oauth/authorize` | 200 login page |
| `https://www.jogospre.com/api/mcp/oauth/token` | token endpoint |
| `https://www.jogospre.com/api/mcp/oauth/register` | dynamic client registration (201) |

### Connection pitfalls

1. **Root-level `.well-known` is redirected.**
   `GET https://www.jogospre.com/.well-known/oauth-protected-resource` returns
   `301 → /en/.well-known/oauth-protected-resource`, which serves the SPA **HTML** instead of JSON.
   Clients that derive the discovery URL from the origin instead of reading the
   `WWW-Authenticate: resource_metadata="..."` header fail and keep reporting `Unauthorized`
   **without ever opening the login page**. Fix: serve the two `.well-known` documents at the root
   origin, or use a client that honors `resource_metadata`.

---

## 2. Tools

| Tool | Scope | Purpose |
|---|---|---|
| `get_guidelines` | games:read | Platform rules for creation/publishing (the only built-in prose) |
| `list_catalog` | games:read | Category / gameplay / graphics / art / tag IDs |
| `list_games` | games:read | List games of the signed-in developer (`page`, `size`, `gameName`) |
| `get_game` | games:read | Latest version summary of one game |
| `get_publish_status` | games:read | Review/listing status **plus the self-test gate (`qa`)** |
| `create_game` | games:write | Create a **free** draft game (does not enter review) |
| `upload_game_package` | games:write | Request a one-time upload URL for a `.zip` build |
| `upload_cover` | games:write | Upload cover images, or request a one-time upload URL |
| `save_version` | games:write | Write an already-hosted build URL onto the latest version |
| `publish_game` | games:publish | Submit the latest version into the existing review flow |

`create_game` required fields: `gameName`, `description`, `categoryId`, `gamePlayId`,
`gameArtId`, `graphicsDimensionId`, `coverImage`, `tagIds`.
Optional: `engineType`, `gameFileUrl`, `versionInfo`.

Rules enforced by the server:

- English game names may only contain letters, digits, spaces and hyphens.
- Games created over MCP are always free (`gameMonentization = 1`).
- **Version numbers are fixed at `1.0.0`.** Always pass `versionInfo: "1.0.0"`; MCP only prepares the
  draft. The real version bump happens in the developer console at submission time, not over MCP.
- `publish_game` does **not** put the game live; it only enters review.
- Never put file bytes into tool arguments — both upload tools return a URL and the file is sent to it.

---

## 3. Happy path

```text
get_guidelines            → read the rules once
list_catalog              → resolve the five ID fields
upload_cover              → ticket → POST images → coverImage string
create_game               → draft (free, no review)
upload_game_package       → ticket → POST the .zip
get_game                  → wait until gameFileUrl is a real path (not "uploading")
get_publish_status        → qa.checks must all pass
publish_game              → submit for review
get_publish_status        → poll until approved / rejected
```

`save_version` only exists for builds already hosted elsewhere: if you upload through
`upload_game_package`, the server records the file itself and you can skip it.

### 3.1 Upload covers

Two ways to use `upload_cover`:

```jsonc
// A. Direct: base64 payloads, saved immediately, returns the coverImage string
{ "gameId": 10064, "images": [{ "fileName": "cover.jpg", "dataBase64": "..." }] }

// B. Ticket: no gameId → returns a one-time upload URL, then create_game gets the coverImage value
{}
```

Ticket response (verified):

```json
{
  "uploadUrl": "https://www.jogospre.com/api/mcp/upload/ticket/<token>",
  "method": "POST",
  "field": "file",
  "contentType": "multipart/form-data",
  "kind": "cover",
  "expiresIn": 900,
  "limits": {
    "maxBytes": 2097152,
    "maxCount": 5,
    "types": ["jpg", "jpeg", "png"],
    "landscape": "1280x720 16:9 minimum",
    "square": "444x444 minimum"
  },
  "message": "..."
}
```

Hard limits: ≤ 2MB per image, ≤ 5 images per call, `jpg` / `jpeg` / `png` only. Landscape must be
**16:9 and at least 1280×720**; square must be at least 444×444. **At least one landscape image is
required** when writing the cover back to a game.

### 3.2 Upload the build

```json
{ "gameId": 10064, "fileName": "coin-rush.zip", "size": 15728640 }
```

The tool returns a one-time upload URL; then

```bash
curl -X POST "<uploadUrl>" -F "file=@coin-rush.zip"
```

- Upload a **`.zip`** only, in the multipart field `file`.
- The per-package limit matches the console `ZIP_FILE_SIZE_LIMIT`, default **500MB**.
- The ticket expires; request a new one instead of retrying an expired URL.
- While the server processes the archive, `get_game().gameFileUrl` returns the literal string
  `uploading`. Poll until it becomes a real path, then run the self-test.
- **`errorCode` is misleadingly named.** `"548"` means the package was processed **successfully**;
  do not treat it as a failure. Any other value is a real problem. Newer builds also return
  `errorCodeText` with a human-readable explanation of the current code.

Example `create_game` payload (IDs from `list_catalog`; the catalog changes, always read it live):

```json
{
  "gameName": "Coin Rush",
  "description": "Collect coins, dodge bombs, beat the clock.",
  "categoryId": 88,
  "gamePlayId": 16,
  "gameArtId": 40,
  "graphicsDimensionId": 26,
  "coverImage": "<name>.jpg,<name>.jpg",
  "tagIds": [11, 12],
  "engineType": "cocos",
  "versionInfo": "1.0.0"
}
```

`coverImage` is **not a URL**: it is a comma-separated list of uploaded image file names, exactly as
returned by `list_games` or by `upload_cover` (for example `ee5619a97862.jpg,51ddafa0734d.jpg`).

---

## 4. Self-test gate

`publish_game` fails with `GAME_VERSION_QA_ERROR` until every check in
`get_publish_status().qa.checks` passes. `qa` looks like this (verified on a fresh draft):

```json
{
  "passed": false,
  "standard": "Retail builds need SAVE_OPTION and a version-matched SAVE_SDK. Buy-out games also need SAVE_OPTION_DEMO and SAVE_SDK_DEMO.",
  "checks": [
    { "code": "SAVE_OPTION", "name": "retail settings", "passed": false,
      "how": "Open the self-test page of this game in the console and save the retail settings." },
    { "code": "SAVE_SDK", "name": "retail SDK self-test", "passed": false,
      "how": "Run the retail self-test with version 1.0.0 and save its SDK data." },
    { "code": "SAVE_OPTION_DEMO", "name": "demo settings", "passed": false, "how": "..." },
    { "code": "SAVE_SDK_DEMO", "name": "demo SDK self-test", "passed": false, "how": "..." }
  ],
  "missing": ["SAVE_OPTION retail settings", "SAVE_SDK retail SDK self-test", "..."]
}
```

| Code | Required for | Meaning |
|---|---|---|
| `SAVE_OPTION` | retail (always) | Retail settings saved on the console self-test page |
| `SAVE_SDK` | retail (always) | SDK self-test data saved for **the current version** |
| `SAVE_OPTION_DEMO` | buy-out (`gameMonentization = 2`) | Demo settings saved |
| `SAVE_SDK_DEMO` | buy-out | Demo SDK self-test data saved |

Text fields (`standard`, `name`, `how`, `versionStatusText`, `gameStatusText`) are localized by the
server, so branch on `code` and `passed`, never on the strings.

Key-pad configuration is **not** a submission condition. `SAVE_SDK` is bound to the current version,
and over MCP that version is always `1.0.0` — run the self-test against `1.0.0`. The version number is
bumped in the developer console when the game is submitted, so do not try to pass a higher version
through MCP.

---

## 5. Status codes

Documented by `get_guidelines`:

| Field | Value | Meaning |
|---|---|---|
| `versionStatus` | `-1` | draft |
| | `0` | pending review |
| | `1` | approved |
| | `2` | rejected (see `refuseMessage`) |
| `gameStatus` | `-1` | not published |
| | `1` | delisted |
| | `2` | published |

Observed in `list_games` but **not documented**: `gameStatus = 3`. Treat unknown values as
"check the developer console" rather than guessing.

`get_publish_status` also returns `versionStatusText` / `gameStatusText` and the `qa` block;
`get_game` returns neither.

---

## 6. Verified response shapes

`list_games` (page 1, size 10):

```json
{
  "page": 1, "size": 10, "total": 21,
  "list": [{
    "gameId": 9859,
    "versionId": null,
    "gameName": "jjjj",
    "version": null,
    "versionStatus": 1,
    "gameStatus": 2,
    "engineType": null,
    "gameFileUrl": null,
    "coverImage": "fd5cdd4739984d4da0c78a41e8ed5837.jpg,07fac5723f7b4b7c86618f0ad7652c6e.jpg",
    "updateTime": 1792462219000,
    "refuseMessage": null
  }]
}
```

`get_game` (same game):

```json
{
  "gameId": 9859,
  "versionId": 121817183,
  "gameName": null,
  "version": "V1.1.0",
  "versionStatus": -1,
  "gameStatus": -1,
  "engineType": null,
  "gameFileUrl": "/opt/jogos/source/games/release/jjjj/7857a8",
  "coverImage": "fd5cdd4739984d4da0c78a41e8ed5837.jpg,07fac5723f7b4b7c86618f0ad7652c6e.jpg",
  "updateTime": 1781677659000,
  "refuseMessage": null
}
```

Things to be careful about when writing client code:

1. `get_game` and `list_games` **disagree** for the same game (`-1/-1` versus `1/2` above).
   `get_game` describes the latest version record, `list_games` the aggregate. Read the field you
   actually need and do not mix them.
2. `get_game.gameFileUrl` returns a **server-side path**, not the URL that was passed in, and
   `gameName` is `null`. Do not parse these paths; only distinguish empty / `uploading` / real path.
3. `updateTime` is epoch milliseconds.

---

## 7. Remaining gaps

1. **No update/delete/version-list tools.** Renaming, re-categorizing, changing the cover of a live
   game, or listing historical versions is console-only.
2. `engineType` has no documented enum.
3. `gameStatus = 3` is undefined.
4. `get_game` vs `list_games` status disagreement (see §6) is undocumented behaviour.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Client keeps retrying, `Unauthorized`, no login page | Root-level `.well-known` redirect (§1) | Use a client that reads `resource_metadata`, or inject a bearer token |
| `enable` never succeeds in the MCP panel | Same as above | Same as above |
| Tools not listed yet right after authorizing | The MCP session is still starting | Wait for the connection to settle, then retry |
| `GAME_VERSION_QA_ERROR` on `publish_game` | Self-test gate not satisfied | Read `qa.checks` / `qa.missing` and finish those console steps |
| `get_game().gameFileUrl == "uploading"` | Archive still being processed | Poll; do not call `save_version` or `publish_game` yet |
| Upload URL rejected / expired | Tickets are one-time and short-lived | Request a new ticket |
| `401` with a token present | Token expired | Re-authorize or refresh the token |
