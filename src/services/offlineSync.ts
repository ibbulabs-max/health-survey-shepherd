import { db, type SyncQueueItem } from "@/db/schema";
import { supabase } from "@/db/client";

const VALID_HOUSE_MEMBER_COLUMNS = new Set([
  "id",
  "house_uuid",
  "member_id",
  "member_name",
  "data",
  "source_files",
  "uploaded_by",
  "uploaded_at",
  "possible_duplicate",
  "created_at",
  "updated_at",
]);

const VALID_HOUSE_COLUMNS = new Set([
  "id",
  "house_id",
  "house_number",
  "address",
  "owner_name",
  "status",
  "latitude",
  "longitude",
  "accuracy",
  "location_status",
  "location_source",
  "mapped_by",
  "mapped_at",
  "pin_type",
  "custom_type",
  "assigned_csw_id",
  "supervisor_id",
  "monthly_income",
  "earning_members",
  "total_members",
  "data",
  "created_by",
  "uploaded_by",
  "uploaded_at",
  "source_files",
  "created_at",
  "updated_at",
  "pin_id",
]);

const VALID_FOLLOW_UP_COLUMNS = new Set([
  "id",
  "house_uuid",
  "member_uuid",
  "due_date",
  "status",
  "reason",
  "notes",
  "risk_level",
  "created_by",
  "created_at",
  "updated_at",
  "completed_at",
  "completed_by",
]);

const TABLE_PRIORITY: Record<string, number> = {
  houses: 1,
  house_members: 2,
  assessments: 3,
  follow_ups: 4,
  map_pins: 5,
  imports: 6,
};

export class OfflineSyncService {
  private static isProcessing = false;
  private static hasPendingWork = false;
  private static hasAutoRepaired = false;

  /**
   * Sanitizes a house_members payload against the canonical database schema.
   * Strips 'status', maps legacy fields, and moves unmapped columns into 'data'.
   */
  public static sanitizeMemberPayload(rawPayload: any): Record<string, any> {
    const payload = { ...rawPayload };
    payload.data =
      typeof payload.data === "object" && payload.data !== null ? { ...payload.data } : {};

    // Map legacy / renamed columns
    if (payload.created_by && !payload.uploaded_by) {
      payload.uploaded_by = payload.created_by;
    }
    if (payload.house_id && !payload.house_uuid) {
      payload.house_uuid = payload.house_id;
    }

    // NEVER send status to house_members (it does not exist in schema cache)
    delete payload.status;
    delete payload.created_by;
    delete payload.house_id;

    // Move any unknown top-level columns into data JSONB
    for (const key of Object.keys(payload)) {
      if (!VALID_HOUSE_MEMBER_COLUMNS.has(key)) {
        payload.data[key] = payload[key];
        delete payload[key];
      }
    }

    return payload;
  }

  /**
   * Sanitizes a houses payload against the canonical database schema.
   * Ensures NOT NULL fields like pin_type and created_by are present.
   */
  public static sanitizeHousePayload(
    rawPayload: any,
    fallbackUserId?: string | null,
  ): Record<string, any> {
    const payload = { ...rawPayload };
    payload.data =
      typeof payload.data === "object" && payload.data !== null ? { ...payload.data } : {};

    if (payload.extra && Object.keys(payload.data).length === 0) {
      payload.data = payload.extra;
      delete payload.extra;
    }

    // NOT NULL constraints on public.houses - canonical default is 'house'
    if (!payload.pin_type) {
      payload.pin_type = "house";
    }
    if (!payload.house_id) {
      payload.house_id = payload.house_number
        ? String(payload.house_number).trim()
        : `H-${String(payload.id || Date.now()).slice(0, 8)}`;
    }
    if (!payload.status) {
      payload.status = "active";
    }
    if (!payload.created_by) {
      payload.created_by = payload.uploaded_by || fallbackUserId || null;
    }

    // Comply with houses_location_status_check constraint ('mapped' | 'not_mapped')
    if (payload.location_status === "unmapped") {
      payload.location_status = "not_mapped";
    } else if (
      !payload.location_status ||
      (payload.location_status !== "mapped" && payload.location_status !== "not_mapped")
    ) {
      payload.location_status =
        payload.latitude != null && payload.longitude != null ? "mapped" : "not_mapped";
    }

    // Move any unknown top-level columns into data JSONB
    for (const key of Object.keys(payload)) {
      if (!VALID_HOUSE_COLUMNS.has(key)) {
        payload.data[key] = payload[key];
        delete payload[key];
      }
    }

    return payload;
  }

  /**
   * Sanitizes a follow_ups payload against the canonical database schema.
   * Strips non-existent columns (like anchor_date) and ensures only valid relational columns.
   */
  public static sanitizeFollowUpPayload(rawPayload: any): Record<string, any> {
    const payload = { ...rawPayload };
    delete payload.anchor_date;
    for (const key of Object.keys(payload)) {
      if (!VALID_FOLLOW_UP_COLUMNS.has(key)) {
        delete payload[key];
      }
    }
    return payload;
  }

  /**
   * Add a single mutation to the sync queue.
   */
  static async queueMutation(
    table: SyncQueueItem["table"],
    operation: SyncQueueItem["operation"],
    payload: any,
  ) {
    await db.sync_queue.add({
      table,
      operation,
      payload,
      timestamp: Date.now(),
      status: "pending",
      retryCount: 0,
      lastAttempt: 0,
    });

    if (typeof navigator !== "undefined" && navigator.onLine) {
      void this.processQueue();
    }
  }

  /**
   * Bulk-enqueue mutations in a single Dexie operation, then trigger sync once.
   */
  static async queueBatch(
    items: Array<{
      table: SyncQueueItem["table"];
      operation: SyncQueueItem["operation"];
      payload: any;
    }>,
  ) {
    if (items.length === 0) return;

    const now = Date.now();
    const records: SyncQueueItem[] = items.map((item) => ({
      table: item.table,
      operation: item.operation,
      payload: item.payload,
      timestamp: now,
      status: "pending",
      retryCount: 0,
      lastAttempt: 0,
    }));

    await db.sync_queue.bulkAdd(records);

    if (typeof navigator !== "undefined" && navigator.onLine) {
      void this.processQueue();
    }
  }

  /**
   * Scans the existing IndexedDB queue, repairs poisoned payloads,
   * resets stuck syncing states, and marks unrecoverable items dead.
   */
  static async repairQueue(): Promise<{
    total: number;
    pending: number;
    failed: number;
    dead: number;
    repaired: number;
  }> {
    try {
      const allItems = await db.sync_queue.toArray();
      let repairedCount = 0;
      let pendingCount = 0;
      let failedCount = 0;
      let deadCount = 0;

      let authUserId: string | null = null;
      try {
        const { data } = await supabase.auth.getUser();
        authUserId = data?.user?.id ?? null;
      } catch {
        // Offline or not logged in
      }

      for (const item of allItems) {
        let needsUpdate = false;
        let newStatus = item.status;
        let newPayload = item.payload;

        // Reset stuck syncing state
        if (item.status === "syncing") {
          newStatus = "pending";
          needsUpdate = true;
        }

        // Sanitize house_members
        if (item.table === "house_members") {
          if (newPayload?.status || newPayload?.created_by || newPayload?.house_id) {
            newPayload = this.sanitizeMemberPayload(newPayload);
            needsUpdate = true;
            repairedCount++;
          }
        }

        // Sanitize houses
        if (item.table === "houses") {
          if (
            !newPayload?.pin_type ||
            !newPayload?.created_by ||
            newPayload?.extra ||
            newPayload?.location_status === "unmapped" ||
            item.error?.includes("houses_location_status_check")
          ) {
            newPayload = this.sanitizeHousePayload(newPayload, authUserId);
            if (item.error?.includes("houses_location_status_check")) {
              newStatus = "pending";
            }
            needsUpdate = true;
            repairedCount++;
          }
        }

        // Sanitize follow_ups
        if (item.table === "follow_ups") {
          const sanitized = this.sanitizeFollowUpPayload(newPayload);
          if (JSON.stringify(sanitized) !== JSON.stringify(newPayload)) {
            newPayload = sanitized;
            needsUpdate = true;
            repairedCount++;
          }
        }

        // Dead letter permanently invalid items (>3 retries or unrecoverable error)
        if (
          (item.retryCount >= 3 ||
            item.error?.includes("PGRST204") ||
            item.error?.includes("violates foreign key constraint")) &&
          item.status !== "dead"
        ) {
          newStatus = "dead";
          needsUpdate = true;
        }

        if (needsUpdate) {
          await db.sync_queue.update(item.id!, {
            status: newStatus,
            payload: newPayload,
          });
        }

        if (newStatus === "pending") pendingCount++;
        else if (newStatus === "failed") failedCount++;
        else if (newStatus === "dead") deadCount++;
      }

      console.info(
        `[SyncQueue] Queue health audit: Total=${allItems.length}, Pending=${pendingCount}, Failed=${failedCount}, Dead=${deadCount}, Repaired=${repairedCount}`,
      );

      return {
        total: allItems.length,
        pending: pendingCount,
        failed: failedCount,
        dead: deadCount,
        repaired: repairedCount,
      };
    } catch (err) {
      console.error("[SyncQueue] Queue repair failed:", err);
      return { total: 0, pending: 0, failed: 0, dead: 0, repaired: 0 };
    }
  }

  /**
   * Process pending items in the sync queue using single-flight execution,
   * rate-limiting, dependency ordering, and backoff.
   */
  static async processQueue() {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    // Single-flight mutex: if already running, flag pending work and return
    if (this.isProcessing) {
      this.hasPendingWork = true;
      return;
    }

    this.isProcessing = true;

    try {
      // Run auto-repair once per session on first sync attempt
      if (!this.hasAutoRepaired) {
        this.hasAutoRepaired = true;
        await this.repairQueue();
      }

      let authUserId: string | null = null;
      try {
        const { data } = await supabase.auth.getUser();
        authUserId = data?.user?.id ?? null;
      } catch {
        // Fallback if auth is unavailable
      }

      if (!authUserId) {
        console.info("[SyncQueue] Deferred: User is not authenticated. Waiting for login.");
        return; // Abort sync
      }

      // Process in bounded batches until no pending work remains
      while (true) {
        this.hasPendingWork = false;

        const rawItems = await db.sync_queue
          .where("status")
          .anyOf("pending", "failed")
          .limit(50)
          .toArray();

        if (rawItems.length === 0) break;

        const now = Date.now();

        // Apply backoff: only retry failed items after at least 15 seconds
        const eligibleItems = rawItems.filter((item) => {
          if (item.status === "failed") {
            const timeSinceLast = now - (item.lastAttempt || 0);
            return timeSinceLast >= 15000 && (item.retryCount || 0) < 3;
          }
          return true;
        });

        if (eligibleItems.length === 0) break;

        // Sort: houses MUST sync before house_members to satisfy foreign key constraints
        eligibleItems.sort((a, b) => {
          const prioA = TABLE_PRIORITY[a.table] || 99;
          const prioB = TABLE_PRIORITY[b.table] || 99;
          if (prioA !== prioB) return prioA - prioB;
          return a.timestamp - b.timestamp;
        });

        const failedHouseUuids = new Set<string>();
        const failedMemberUuids = new Set<string>();

        for (const item of eligibleItems) {
          // If this is a member and its parent house failed in this very cycle, defer it
          if (item.table === "house_members") {
            const parentUuid = item.payload?.house_uuid || item.payload?.house_id;
            if (parentUuid && failedHouseUuids.has(parentUuid)) {
              continue;
            }
          }

          // If this is a follow_up and its parent member or house failed in this cycle, defer it
          if (item.table === "follow_ups") {
            const parentHouse = item.payload?.house_uuid;
            const parentMember = item.payload?.member_uuid;
            if (parentHouse && failedHouseUuids.has(parentHouse)) {
              continue;
            }
            if (parentMember && failedMemberUuids.has(parentMember)) {
              continue;
            }
          }

          // Double check retry limit
          if (item.retryCount >= 3) {
            await db.sync_queue.update(item.id!, {
              status: "dead",
              error: "Max retries exceeded",
              lastAttempt: now,
            });
            console.warn(`[SyncQueue] #${item.id} (${item.table}) -> DEAD (max retries exceeded)`);
            continue;
          }

          await db.sync_queue.update(item.id!, { status: "syncing" });

          let payload = { ...item.payload };

          // Sanitize house_members
          if (item.table === "house_members") {
            payload = this.sanitizeMemberPayload(payload);
          }

          // Sanitize houses
          if (item.table === "houses") {
            payload = this.sanitizeHousePayload(payload, authUserId);
          }

          // Sanitize follow_ups
          if (item.table === "follow_ups") {
            payload = this.sanitizeFollowUpPayload(payload);
          }

          try {
            if (item.operation === "CREATE") {
              const { error } = await supabase.from(item.table).insert(payload);
              if (error) throw error;
            } else if (item.operation === "UPDATE") {
              const { error } = await supabase
                .from(item.table)
                .update(payload)
                .eq("id", payload.id);
              if (error) throw error;
            } else if (item.operation === "DELETE") {
              const { error } = await supabase.from(item.table).delete().eq("id", payload.id);
              if (error) throw error;
            }

            // Sync successful: remove from queue permanently
            await db.sync_queue.delete(item.id!);
            console.info(`[SyncQueue] #${item.id} (${item.table} ${item.operation}) -> SUCCESS`);
          } catch (err: any) {
            if (item.table === "houses" && item.payload?.id) {
              failedHouseUuids.add(item.payload.id);
            }
            if (item.table === "house_members" && item.payload?.id) {
              failedMemberUuids.add(item.payload.id);
            }

            // Section 5: If an item receives 23503 foreign key violation because its parent has not yet synced,
            // do NOT immediately classify it as permanently dead. First verify whether the parent is pending/syncing.
            let isPermanent =
              err?.code === "PGRST204" ||
              err?.status === 400 ||
              err?.code === "23502" ||
              err?.message?.includes("Could not find the") ||
              item.retryCount >= 2;

            if (err?.code === "23503") {
              let parentFound = false;
              if (item.table === "house_members") {
                const parentHouseUuid = item.payload?.house_uuid || item.payload?.house_id;
                if (parentHouseUuid) {
                  const queuedHouse = await db.sync_queue
                    .where("table")
                    .equals("houses")
                    .filter((q) => q.payload?.id === parentHouseUuid)
                    .first();
                  const localHouse = await db.houses.get(parentHouseUuid);
                  parentFound = Boolean(queuedHouse || localHouse);
                }
              } else if (item.table === "follow_ups") {
                const parentMemberUuid = item.payload?.member_uuid;
                if (parentMemberUuid) {
                  const queuedMember = await db.sync_queue
                    .where("table")
                    .equals("house_members")
                    .filter((q) => q.payload?.id === parentMemberUuid)
                    .first();
                  const localMember = await db.house_members.get(parentMemberUuid);
                  parentFound = Boolean(queuedMember || localMember);
                }
              }
              // If parent exists in local system or queue, this is an ordering issue; retry with backoff
              if (parentFound && (item.retryCount || 0) < 3) {
                isPermanent = false;
              }
            }

            const nextStatus = isPermanent ? "dead" : "failed";
            const errorMsg = err?.message || "Unknown sync error";

            await db.sync_queue.update(item.id!, {
              status: nextStatus,
              error: errorMsg,
              retryCount: (item.retryCount || 0) + 1,
              lastAttempt: Date.now(),
            });

            if (isPermanent) {
              console.error(
                `[SyncQueue] #${item.id} (${item.table} ${item.operation}) -> DEAD: ${errorMsg}`,
              );
            } else {
              console.warn(
                `[SyncQueue] #${item.id} (${item.table} ${item.operation}) -> FAILED: ${errorMsg} (will retry in 15s)`,
              );
            }
          }
        }
      }
    } finally {
      this.isProcessing = false;
      if (this.hasPendingWork) {
        this.hasPendingWork = false;
        void this.processQueue();
      }
    }
  }
}

// Set up listeners for online/offline events
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.info("[SyncQueue] Network online. Processing sync queue...");
    void OfflineSyncService.processQueue();
  });

  // Run initial queue repair in the background on startup
  setTimeout(() => {
    void OfflineSyncService.repairQueue();
  }, 1000);
}
