import {BlobRef, type BskyAgent} from '@atproto/api'

import {RAW_VIDEO_VAULT_COLLECTION} from '#/lib/constants'
import {logger} from '#/logger'

/**
 * Permanently registers a video blob in the user's repo under its *honest*
 * (PDS-sniffed) mime type by writing a `RAW_VIDEO_VAULT_COLLECTION` record
 * that references it.
 *
 * Why this exists: our video service stores the original file bytes in the
 * PDS, so the stored blob's mime can be e.g. `video/quicktime`, while the
 * post record embeds the blob as `video/mp4` (the video service rewrites the
 * mime it hands back to the client - see
 * docs/video-service-mime-rewrite-requirement.md). `video/mp4` passes the
 * lexicon accept list, but the PDS checks that the mime declared in a record
 * matches the stored blob's mime the *first* time a blob is referenced
 * (`verifyBlob`); once a blob is made permanent by that first reference,
 * subsequent references skip the check entirely.
 *
 * This registration record is that first reference: written with the honest
 * mime so it passes `verifyBlob` and makes the blob permanent, letting the
 * subsequent post reference the same CID as `video/mp4`.
 *
 * MUST be awaited and succeed before the post record is submitted, and must
 * be a separate request from the post's `applyWrites` (the PDS processes the
 * blob checks of the writes in a batch concurrently, so the registration
 * would race with the post's own `verifyBlob`).
 */
export async function registerRawVideoBlob(
  agent: BskyAgent,
  opts: {blobRef: BlobRef; mimeType: string},
) {
  // Nothing to fix up when the mime we're going to write into the post record
  // already equals the honest mime: the post itself will pass `verifyBlob`,
  // and a registration record would be redundant.
  if (opts.blobRef.mimeType === opts.mimeType) {
    return
  }

  await agent.com.atproto.repo.createRecord({
    repo: agent.assertDid,
    collection: RAW_VIDEO_VAULT_COLLECTION,
    // Note: deliberately NOT passing `validate` - the collection is not a
    // known lexicon, and passing `validate: true` would make the PDS reject
    // the write with "Unknown lexicon type". Without it the record is stored
    // with `validationStatus: 'unknown'` and no blob accept check runs, which
    // is exactly what we need for the honest (non-mp4) mime.
    record: {
      $type: RAW_VIDEO_VAULT_COLLECTION,
      createdAt: new Date().toISOString(),
      // The honest mime (e.g. `video/quicktime`) - must match what the PDS
      // sniffed at upload time or `verifyBlob` rejects this reference.
      blob: new BlobRef(opts.blobRef.ref, opts.mimeType, opts.blobRef.size),
    },
  })

  logger.debug('Registered raw video blob', {
    collection: RAW_VIDEO_VAULT_COLLECTION,
  })
}
