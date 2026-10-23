# Structured private activity records

`content/current` contains three fields. This synthetic example illustrates the shape:

```json
{
  "schemaVersion": 2,
  "categories": {
    "11111111111111111111111111111111": { "name": "Вигадані пригоди", "order": 0 }
  },
  "ideas": {
    "22222222222222222222222222222222": {
      "categoryId": "11111111111111111111111111111111",
      "markdown": "Вигадайте назву для нової планети."
    }
  }
}
```

Each map key is a permanent 32-character lowercase hexadecimal ID. Category `order` values must be unique non-negative integers. Ideas must reference an existing category and contain non-empty Markdown. Empty categories are hidden until an idea uses them. The app rejects unknown schema versions, unexpected fields, malformed IDs, missing categories, over 64 categories or 1,000 ideas, and content over 900,000 serialized UTF-8 bytes.

All family members have the same private catalog. Browser clients cannot edit this document; content maintenance uses the owner's Firebase console or authenticated administrator tooling. Category and idea maps are exempt from indexing because the app fetches the catalog as one document.

## Prepare a legacy migration locally

Keep the original Markdown under ignored `private/` or outside the checkout. Supply the H2 headings that contain navigation or references rather than activities:

```sh
npm run migrate:private -- /absolute/path/to/ideas.md "Contents heading" "References heading"
```

The command writes files only into this repository's ignored `private/` directory:

- `content-v2.json`: structured categories and individual activity records.
- `content-v2.firestore.json`: the same document in Firestore REST `fields` format, ready for an authenticated document replacement.
- `content-v2.migration.json`: SHA-256 hashes of the original Markdown and both output files, excluded section names, and aggregate record counts.

The command preserves the exact existing category and activity IDs. It omits the source title, table of contents and excluded references; only the selected activity records remain. It prints counts and output paths, never private activity text. It makes no cloud calls and leaves the original file intact. Existing output files require an explicit `--force` to replace.

This is an initial conversion tool, not an ongoing Markdown synchronization tool. Re-importing a changed source can derive new IDs for edited activities. After migration, maintain the structured records while preserving their keys, and keep the original Markdown as a backup.

## Replace an existing cloud document safely

1. Deploy the app version that understands both legacy and version 2 documents. Reload any open tabs after deployment; tabs running an older build cannot read version 2. Deploy the included index exemptions for `content.categories` and `content.ideas`; the legacy `markdown` exemption can remain during transition.
2. Using the owner's authenticated administrator session, GET `content/current` and save the complete response, including its `updateTime`, in a private backup outside source control. Save a read-only snapshot of `draws/current` for verification too, if it exists. Do not print the private document or tokens to logs.
3. Before replacing anything, check that the current remote document is still legacy data. Hash the UTF-8 bytes of its `markdown` field and compare with `originalMarkdownSha256` in the manifest. Check that its `excludedSections` matches the manifest's exclusions. Verify the two generated files against their manifest hashes. Stop if any check fails: the source or cloud content changed, so regenerate/review the migration first.
4. Replace **only** `content/current` with the generated REST payload. For Firestore REST, use `PATCH https://firestore.googleapis.com/v1/projects/PROJECT_ID/databases/(default)/documents/content/current` with `currentDocument.updateTime` set to the exact timestamp read in step 2. Use the payload as the request body and omit `updateMask`; this replaces all fields and removes the old whole-file `markdown` and `excludedSections`. If the precondition fails, read and compare again instead of overwriting newer content.
5. Read the resulting document back. Verify `schemaVersion: 2`, exactly the three intended top-level fields, record counts, and unchanged IDs. The migration must not write to `draws/current` or `members`. In the app, previously seen IDs should remain seen and a wording edit to an existing ID should not make it eligible again. Concurrent legitimate draws can advance history, so do not restore an older history snapshot.

For a new installation, use the same payload to create `content/current` with an existence precondition that requires it not to exist. There is no legacy source/hash comparison in that case.

Content and shared history are still read together in each draw transaction. If the catalog changes during a draw, the transaction retries against the new version. A legacy-to-structured replacement with the same IDs therefore preserves the shared no-repeat behavior.

## Maintain the structured collection

- Edit an existing idea's `markdown` value without changing its map key. Markdown emphasis, links and lists remain supported by the safe renderer.
- Rename/reorder categories by changing their `name`/`order` values while retaining keys. Move an idea by changing `categoryId`; its shared seen state follows its ID.
- To add an activity, create a new map entry with a fresh 32-character hexadecimal ID and fields `categoryId` and `markdown`. A UUID with hyphens removed is suitable; never reuse a deleted idea's ID for a different activity. Newly added IDs are unseen.
- Remove an idea by deleting its map entry. Deleted IDs are pruned from history on the next committed draw. Before deleting a category, move or remove all ideas that reference it.
- Keep a private export of the structured document as the current backup. The original Markdown remains a historical backup; updating it alone no longer changes the live app.

If rollback is needed, restore the backed-up content document using a fresh update-time precondition, while leaving current shared history untouched. Keep the app version that supports both formats. Never overwrite history from a backup during a content-only rollback.
