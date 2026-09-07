import Dexie, { type Table } from "dexie";
import type { House, HouseMember, MemberAssessment, FollowUp } from "./types";

export interface SyncQueueItem {
  id?: number;
  operation: "CREATE" | "UPDATE" | "DELETE";
  table: "houses" | "house_members" | "assessments" | "follow_ups" | "map_pins" | "imports";
  payload: any;
  timestamp: number;
  status: "pending" | "syncing" | "failed" | "dead";
  error?: string;
  retryCount: number;
  lastAttempt?: number;
}

export class LocalDB extends Dexie {
  houses!: Table<House, string>;
  house_members!: Table<HouseMember, string>;
  assessments!: Table<MemberAssessment, string>;
  follow_ups!: Table<FollowUp, string>;
  imports!: Table<any, string>;
  sync_queue!: Table<SyncQueueItem, number>;

  constructor() {
    super("NCDManagementLocalDB");
    this.version(1).stores({
      houses: "id, created_by, status",
      house_members: "id, house_id, created_by, status",
      assessments: "id, member_id, created_by",
      follow_ups: "id, member_id, assigned_chw_id, status",
      imports: "id, status, created_by",
      sync_queue: "++id, operation, table, status, timestamp",
    });
  }
}

export const db = new LocalDB();
