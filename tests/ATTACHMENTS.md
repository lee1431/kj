# Attachment verification — 2026-11-16

## Scope and evidence

- Production: `https://kijeng.co.kr/admin/`, `/notice.html`, repository `lee1431/kj`.
- Reviewed main at `221cf36ed9074a565c1dd36c7ecd09fcd6c781fc`.
- Live administrator demo shows the multiple-file input and document fields.
- Live notice expands and displays its existing PNG; that PNG responds HTTP 200.
- Current content contains 1 notice and 1,087 portfolio records, with no document attachments.
- No production test post, attachment, content change, or deletion was performed.

## Fixes

1. Lock publishing and editor navigation while selected files are being read.
2. Prepare the entire selection before staging any file. Invalid, oversized, empty, or unreadable files leave the draft unchanged.
3. Supply the original document name in the public link's `download` attribute instead of using the timestamp/UUID asset basename.
4. Viewing an old portfolio item no longer adds an empty `attachments` property to it.

Unlinking an attachment deliberately retains its asset file so existing links and historical revisions remain usable. It removes the published attachment link only after publishing.

## Automated DOM integration test

Prerequisites: Node.js 22+ and `jsdom`. To avoid modifying repository dependencies:

```sh
npm install --prefix /tmp/kj-test-deps jsdom --no-audit --no-fund
NODE_PATH=/tmp/kj-test-deps/node_modules node tests/attachments.cjs
```

The test runs the actual admin HTML, admin JavaScript, public HTML, and public rendering JavaScript in JSDOM. GitHub endpoints are replaced by an in-memory API which applies blob, tree, commit, and branch updates. A local HTTP server serves the resulting published JSON and binary assets.

For both notice and portfolio:

- Accept PDF, HWP, HWPX, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT by extension.
- Select multiple files, preserve names containing Korean characters, accept uppercase PDF extension.
- Accept exactly 5,242,880 bytes (5 MiB, the existing UI's “5MB”). Reject 5,242,881 bytes, zero bytes, EXE, and simulated file-read errors.
- Reject a mixed valid/invalid selection without partially staging it.
- Delay a read and verify publishing and navigation stay blocked until completion.
- Verify changes stay local until confirmation; exercise 4 mock publish commits in total.
- Re-read the published JSON in the administrator, then unlink one document and publish again.
- Render public links, check original download-name attributes and notice expansion behavior.
- Retrieve 24 document payloads and 2 PNGs over local HTTP and compare every byte with the input.
- Compare every existing post, company record, and business record with the original content.

Result: all assertions pass after the fix. Running the same test against the pre-fix code fails on partial attachment of a mixed invalid selection.

The document payloads test extension acceptance and binary transport, not whether each format opens in its native office application. JSDOM checks DOM attributes and HTTP retrieval, not the browser's actual download manager. A headless Chromium run could not start in the execution environment, so browser download completion is not claimed by these automated tests.

## Remaining production verification (requires approval)

Proposed live actions:

1. Create one clearly labeled temporary notice and one temporary portfolio item titled `[첨부기능 점검] 2026-11-16 — 테스트 후 삭제`.
2. Attach a small TXT and PDF plus an exactly 5 MiB TXT file to each item, using the actual administrator interface. Attempt an EXE and an oversized TXT to confirm rejection without publishing them.
3. Publish, open the public pages, download and compare all attached files, then unlink one attachment and republish to check that its public link disappears.
4. Delete only the two newly created test posts and publish the cleanup. Leave existing records untouched. Uploaded test assets remain in version history; no physical asset deletion is proposed.

This full production workflow has not been executed. Administrator authentication is also required; the connected GitHub tool does not provide a browser login token.
