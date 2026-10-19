import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workspace, Order } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const WORKSPACES_FILE = path.join(DATA_DIR, 'workspaces.json');

class WorkspaceService {
  private workspaces: Map<string, Workspace> = new Map();

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(WORKSPACES_FILE)) {
        const raw = fs.readFileSync(WORKSPACES_FILE, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const w of list) {
            if (w.workspaceId) this.workspaces.set(w.workspaceId, w);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load workspaces from disk:', err);
    }
  }

  public saveToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const list = Array.from(this.workspaces.values());
      fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save workspaces to disk:', err);
    }
  }

  public createWorkspace(params: {
    buyerId: string;
    sellerId: string;
    originType: 'gig' | 'project';
    originId: string;
    activeOrderId?: string;
  }): Workspace {
    const workspaceId = 'ws_' + randomUUID().slice(0, 12);
    const workspace: Workspace = {
      workspaceId,
      buyerId: params.buyerId,
      sellerId: params.sellerId,
      originType: params.originType,
      originId: params.originId,
      createdAt: new Date().toISOString().split('T')[0],
      status: 'active',
      activeOrderId: params.activeOrderId
    };
    this.workspaces.set(workspaceId, workspace);
    this.saveToDisk();
    return workspace;
  }

  public getWorkspace(workspaceId: string): Workspace | undefined {
    return this.workspaces.get(workspaceId);
  }

  public getWorkspacesForUser(userId: string): Workspace[] {
    return Array.from(this.workspaces.values()).filter(w => w.buyerId === userId || w.sellerId === userId);
  }

  public findWorkspaceByOrder(orderId: string, orders: Order[]): Workspace | undefined {
    const order = orders.find(o => o.id === orderId);
    if (!order) return undefined;
    if (order.workspaceId) {
      return this.workspaces.get(order.workspaceId);
    }
    // Fallback search by origin or activeOrderId
    for (const w of this.workspaces.values()) {
      if (w.activeOrderId === orderId) return w;
    }
    return undefined;
  }

  public ensureWorkspaceForOrder(order: Order): Workspace {
    if (order.workspaceId && this.workspaces.has(order.workspaceId)) {
      return this.workspaces.get(order.workspaceId)!;
    }
    // Check if workspace exists for origin
    const originType = order.projectId ? 'project' : 'gig';
    const originId = order.projectId || order.gigId || order.id;

    // For gig orders, public gig purchases create independent workspaces UNLESS follow-on work in same workspace
    let existing = Array.from(this.workspaces.values()).find(w => 
      w.buyerId === order.buyerId && 
      w.sellerId === order.sellerId && 
      w.status === 'active' &&
      (order.workspaceId ? w.workspaceId === order.workspaceId : false)
    );

    if (!existing) {
      existing = this.createWorkspace({
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        originType,
        originId,
        activeOrderId: order.id
      });
    }

    order.workspaceId = existing.workspaceId;
    existing.activeOrderId = order.id;
    this.saveToDisk();
    return existing;
  }

  public migrateLegacyOrders(orders: Order[], dryRun: boolean = false): { migratedCount: number; dryRun: boolean; details: string[] } {
    let migratedCount = 0;
    const details: string[] = [];
    for (const o of orders) {
      if (!o.workspaceId || !this.workspaces.has(o.workspaceId)) {
        migratedCount++;
        if (!dryRun) {
          const ws = this.ensureWorkspaceForOrder(o);
          details.push(`Migrated order ${o.id} to workspace ${ws.workspaceId}`);
        } else {
          details.push(`[DryRun] Would migrate order ${o.id} to new workspace for buyer ${o.buyerId} & seller ${o.sellerId}`);
        }
      }
    }
    return { migratedCount, dryRun, details };
  }
}

export const workspaceService = new WorkspaceService();
