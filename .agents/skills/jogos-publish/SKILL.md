---
name: jogos-publish
description: Publish a finished build to the Jogos store through the Jogos MCP server - create a draft, upload the zip and covers, clear the self-test gate, submit for review and read status. Use when the task mentions publishing/uploading/submitting a game to Jogos, creating a game entry, setting category/art/tags, uploading a package or cover, GAME_VERSION_QA_ERROR, or connecting the https://www.jogospre.com/api/mcp endpoint. In-game SDK integration is covered by jogos-sdk-core.
---

# Publish a game through the Jogos MCP server

This skill covers **store publishing only**. For in-game SDK integration (ads, save, ranking, banner)
read `jogos-sdk-core` first; publishing assumes the build already passes
`tools/verify_integration.py` and `tools/jogos_test.py`.

Endpoint (pre-release): `https://www.jogospre.com/api/mcp`
Auth: OAuth 2.1 authorization code + PKCE, scopes `games:read` / `games:write` / `games:publish`.

Full reference, verified responses and limits: [`docs/publish-mcp.md`](../../../docs/publish-mcp.md).

## Tools

| Tool | Scope |
|---|---|
| `get_guidelines` / `list_catalog` / `list_games` / `get_game` / `get_publish_status` | games:read |
| `create_game` / `upload_game_package` / `upload_cover` / `save_version` | games:write |
| `publish_game` | games:publish |

## 0. Preconditions

- The build is a web build that already loads the Jogos SDK and passes the acceptance checks.
- You have the build as a **`.zip`** (default 500MB limit).
- You have cover images: `jpg` / `jpeg` / `png`, ≤ 2MB each, ≤ 5 per call, **at least one landscape
  16:9 ≥ 1280×720** (square ≥ 444×444 if you add one).
- The self-test gate can be satisfied: retail settings + a version-matched SDK self-test.

If any of these is missing, stop and ask. Never invent a `gameFileUrl` or a `coverImage` value.

## 1. Connect once

```json
{ "mcpServers": { "jogosPre": { "url": "https://www.jogospre.com/api/mcp" } } }
```

If the client loops on `Unauthorized` without a login page, the cause is the root-level
`.well-known` redirect (`docs/publish-mcp.md` §1) — switch client or inject a bearer token. If the
tool list is empty right after authorizing, the MCP session is still starting: wait and retry.

## 2. Read the rules and the ID tables

```text
get_guidelines()   → naming rules, free-by-default, QA gate, status codes
list_catalog()     → categories / gameplays / graphics / arts / tags
```

| Field | Source array |
|---|---|
| `categoryId` | `categories` |
| `gamePlayId` | `gameplays` |
| `gameArtId` | `arts` |
| `graphicsDimensionId` | `graphics` |
| `tagIds` | `tags` |

Never invent IDs; the catalog is server-side and changes.

## 3. Upload covers first

Without `gameId`, the tool returns a one-time upload URL:

```json
{ "uploadUrl": "<ticket>", "method": "POST", "field": "file", "expiresIn": 900,
  "limits": { "maxBytes": 2097152, "maxCount": 5, "types": ["jpg", "jpeg", "png"] } }
```

```bash
curl -X POST "<uploadUrl>" -F "file=@cover.jpg" -F "file=@square.png"
```

It returns the `coverImage` string to pass to `create_game`. Alternatively pass base64 images together
with a `gameId` and the server writes them to that draft directly.

Tickets are one-time and short-lived: request a new one instead of retrying an expired URL.

## 4. Create the draft

```json
{
  "gameName": "Coin Rush",
  "description": "Collect coins, dodge bombs, beat the clock.",
  "categoryId": 88,
  "gamePlayId": 16,
  "gameArtId": 40,
  "graphicsDimensionId": 26,
  "coverImage": "<from upload_cover>",
  "tagIds": [11, 12],
  "engineType": "cocos",
  "versionInfo": "V1.0.0"
}
```

- English names: letters, digits, spaces, hyphens only.
- Created games are always free; there is no price field.
- `create_game` produces a draft (`versionStatus = -1`) and does not enter review.

## 5. Upload the build

```json
{ "gameId": 10064, "fileName": "coin-rush.zip", "size": 15728640 }
```

```bash
curl -X POST "<uploadUrl>" -F "file=@coin-rush.zip"
```

Never put file bytes into tool arguments. Then poll `get_game(gameId)` until `gameFileUrl` is no
longer the literal string `uploading`.

`save_version` is only for builds hosted elsewhere; skip it when you uploaded through the MCP ticket.

## 6. Clear the self-test gate

```text
get_publish_status(gameId).qa
→ { passed, standard, checks: [{ code, name, passed, how }], missing: [...] }
```

| Code | Required for |
|---|---|
| `SAVE_OPTION` | retail, always |
| `SAVE_SDK` | retail, always — and it is **bound to the current version** |
| `SAVE_OPTION_DEMO` | buy-out only |
| `SAVE_SDK_DEMO` | buy-out only |

These are console actions (`qa.checks[].how` tells the user exactly what to do). Report the missing
codes to the user; do not try to satisfy them from the MCP side.

## 7. Submit

```json
{ "gameId": 10064, "versionInfo": "V1.0.0" }
```

`publish_game` moves the version to **pending review** (`versionStatus = 0`); it never publishes
directly. `GAME_VERSION_QA_ERROR` means the gate in §6 is not satisfied — report `qa.missing` and stop.

## 8. Verify and report

```text
get_publish_status(gameId)
```

- `versionStatus`: `-1` draft, `0` pending review, `1` approved, `2` rejected (read `refuseMessage`)
- `gameStatus`: `-1` not published, `1` delisted, `2` published
- Other values (for example `3`) are undocumented: check the console instead of guessing.

Tell the user: `gameId`, how far the flow got, where the build came from, what blocked submission
(if anything), and every assumption you made (build URL, cover names, `engineType`).

Do not poll in a tight loop; review is asynchronous.

## Hard rules

- **Do not invent `gameFileUrl` or `coverImage`.** Both must come from an upload.
- **Do not push file bytes into tool arguments.** Use the ticket URL returned by the upload tools.
- **Do not retry `publish_game` on `GAME_VERSION_QA_ERROR`.** The fix is the console self-test.
- **Do not mix `get_game` and `list_games` status fields.** They disagree for the same game; say which
  one you read.
- **Do not submit while `gameFileUrl == "uploading"`.**
- **Publishing is an external side effect.** Confirm the game and the target build with the user before
  `create_game`, both uploads, `save_version` and especially `publish_game`.
