# Building-code knowledge (RAG)

Retrieval data for the codes we design to, so any session can look up a clause, value or page quickly.

## What is here (committed, public)

| Path | What |
|---|---|
| `<code>/sections.json` | Chapter and section index with printed page numbers (our English titles) |
| `<code>/notes.jsonl` | Our own notes, one clause per line: section, page, topic, plain-English summary, keywords (English + Arabic), projects where used |
| `../../tools/code_rag/` | `extract.mjs` builds a local full-text index from a licensed PDF; `search.mjs` searches notes + local text |

Codes so far: `sbc-301-2018` (Loading and Forces, from the Arabic SBC 301-AR-18).

## What is NOT here, on purpose

The code text and PDFs. The Saudi Building Code National Committee holds the copyright and forbids reproduction; this repository is public. The full text lives only on the user's machine in `%USERPROFILE%\code-library\<code-id>\` (built by `extract.mjs`). Never commit or upload it.

## Use

```bash
cd tools/code_rag && npm install            # once (pdfjs-dist)
node extract.mjs sbc-301-2018-ar "<path to SBC 301-AR-18.pdf>" --offset 16   # once per code PDF, local only
node search.mjs "minimum wind load freestanding wall"     # notes + local text
node search.mjs "29-8"                                     # by section number
node search.mjs "التعرض" --code sbc-301                   # Arabic keywords
```

Results show `[note]` (ours, reliable) and `[text]` (local extract). The Arabic PDF uses a font encoding that scrambles some letters when extracted; section numbers and figures come out correctly, and Arabic keyword hits are best-effort. Read the clause in the PDF at the printed page before quoting it in a calculation.

## Adding a code or a note

1. Run `extract.mjs` on the PDF (local). Find the printed-page offset from the PDF (page that carries printed page 1).
2. Add `sections.json` from the contents pages, titles in your own words.
3. Add a line to `notes.jsonl` for every clause you actually use in a design: summary in your own words, the value, the page, keywords in English and Arabic, and the project. Short quotations only where the exact wording matters.
4. When a design depends on a figure or table the edition does not print (for example the SBC 301-AR wind map), say so in the note and where to find it.
