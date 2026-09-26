import { NextResponse } from "next/server";
import { lt } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { HOUSEKEEPING, SANDBOX } from "@/lib/config";
import { pruneStaleSandboxes } from "@/lib/demo/sandbox";
import { listAllStoragePaths } from "@/lib/repositories/documents";
import {
  deleteObjects,
  isStorageConfigured,
  listObjectKeys,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Orphan scans walk the whole bucket; give them room. */
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  // Fail CLOSED: with no secret configured the job cannot run at all, so it
  // can never execute unprotected. Vercel sends
  // `Authorization: Bearer <CRON_SECRET>` automatically for vercel.json crons
  // once CRON_SECRET is set (Phase 13); locally, pass the header by hand.
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Nightly housekeeping, three jobs in one protected route:
 *   1. delete sandbox accounts past their TTL (R2 objects first, then rows)
 *   2. delete R2 objects with no document row, once they are old enough that
 *      they cannot be an upload still in flight
 *   3. prune stale rate-limit windows
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = {
    sandboxUsers: 0,
    sandboxObjects: 0,
    orphans: 0,
    orphanBytes: 0,
    rateLimitsPruned: 0,
  };

  try {
    const pruned = await pruneStaleSandboxes(SANDBOX.ttlHours);
    summary.sandboxUsers = pruned.users;
    summary.sandboxObjects = pruned.objects;
  } catch (err) {
    console.error("[housekeeping] sandbox prune failed:", err);
    return NextResponse.json(
      { error: "Sandbox prune failed", summary },
      { status: 500 },
    );
  }

  try {
    if (isStorageConfigured()) {
      const objects = await listObjectKeys();
      const known = new Set(await listAllStoragePaths());
      const cutoff =
        Date.now() - HOUSEKEEPING.orphanMinAgeMinutes * 60 * 1000;

      const orphans = objects.filter(
        (obj) =>
          !known.has(obj.key) &&
          obj.lastModified !== null &&
          obj.lastModified.getTime() < cutoff,
      );

      if (orphans.length > 0) {
        await deleteObjects(orphans.map((obj) => obj.key));
      }

      summary.orphans = orphans.length;
      summary.orphanBytes = orphans.reduce((sum, obj) => sum + obj.size, 0);
    }
  } catch (err) {
    console.error("[housekeeping] orphan scan failed:", err);
    return NextResponse.json(
      { error: "Orphan scan failed", summary },
      { status: 500 },
    );
  }

  try {
    const cutoff = new Date(
      Date.now() - HOUSEKEEPING.rateLimitRetentionDays * 24 * 60 * 60 * 1000,
    );
    const removed = await db
      .delete(rateLimits)
      .where(lt(rateLimits.windowStart, cutoff))
      .returning({ bucket: rateLimits.bucket });
    summary.rateLimitsPruned = removed.length;
  } catch (err) {
    console.error("[housekeeping] rate-limit prune failed:", err);
    return NextResponse.json(
      { error: "Rate-limit prune failed", summary },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, summary });
}
