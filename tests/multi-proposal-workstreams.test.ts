/**
 * End-to-End Verification:
 * ONE PROJECT -> MANY PROPOSALS -> MANY ACCEPTED FREELANCERS -> MANY INDEPENDENT WORKSTREAMS (USD ONLY)
 */
process.env.PORT = '3007';
(process.env as any).NODE_ENV = 'test';

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3007;
const BASE = `http://localhost:${PORT}`;
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const SNAPSHOT_DIR = path.join(DATA_DIR, '..', '.test-snapshot-multi-proposal');

function snapshotData() {
  fs.rmSync(SNAPSHOT_DIR, { recursive: true, force: true });
  if (fs.existsSync(DATA_DIR)) fs.cpSync(DATA_DIR, SNAPSHOT_DIR, { recursive: true });
}
function restoreData() {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  if (fs.existsSync(SNAPSHOT_DIR)) fs.cpSync(SNAPSHOT_DIR, DATA_DIR, { recursive: true });
  fs.rmSync(SNAPSHOT_DIR, { recursive: true, force: true });
}

async function api(method: string, p: string, token?: string, body?: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function demoToken(userId: string): Promise<string> {
  const r = await api('POST', '/api/auth/demo-session', undefined, { userId });
  assert.strictEqual(r.status, 200, `demo-session for ${userId} failed: ${JSON.stringify(r.data)}`);
  return r.data.token;
}

async function main() {
  snapshotData();
  try {
    const serverMod: any = await import('../server.ts');
    await new Promise(r => setTimeout(r, 1000));

    const { users } = serverMod;

    const ensureUser = (id: string, name: string, role: 'employer' | 'freelancer') => {
      let u = users.find((x: any) => x.id === id);
      if (!u) {
        u = {
          id,
          name,
          username: id,
          email: `${id}@example.com`,
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
          role,
          hourlyRate: 50,
          tagline: `${name} Title`,
          bio: 'Bio',
          location: 'United States',
          status: 'active',
          emailVerified: true,
          verified: true,
          Balance: 0,
          earned: 0,
          spent: 0,
        };
        users.push(u);
      } else {
        u.status = 'active';
        u.emailVerified = true;
        u.verified = true;
      }
      return u;
    };

    console.log('--- Setting up Buyer and 5 Freelancers (A, B, C, D, E) ---');
    const buyerId = 'buyer_multi_proj';
    ensureUser(buyerId, 'Buyer Client', 'employer');
    ensureUser('freelancer_A', 'Freelancer A', 'freelancer');
    ensureUser('freelancer_B', 'Freelancer B', 'freelancer');
    ensureUser('freelancer_C', 'Freelancer C', 'freelancer');
    ensureUser('freelancer_D', 'Freelancer D', 'freelancer');
    ensureUser('freelancer_E', 'Freelancer E', 'freelancer');

    const buyerToken = await demoToken(buyerId);
    const tokenA = await demoToken('freelancer_A');
    const tokenB = await demoToken('freelancer_B');
    const tokenC = await demoToken('freelancer_C');
    const tokenD = await demoToken('freelancer_D');
    const tokenE = await demoToken('freelancer_E');

    // Fund buyer wallet with $5,000 USD
    const depRes = await api('POST', '/api/wallet/deposit', buyerToken, { amount: 5000 });
    assert.strictEqual(depRes.status, 200, `Deposit failed: ${JSON.stringify(depRes.data)}`);

    // 1. Buyer creates ONE project
    console.log('1. Creating project "Build my e-commerce website"...');
    const projRes = await api('POST', '/api/projects', buyerToken, {
      buyerId,
      buyerName: 'Buyer Client',
      title: 'Build my e-commerce website',
      category: 'Development & IT',
      description: 'Full-stack e-commerce build with design, frontend, backend, and QA.',
      budgetMin: 400,
      budgetMax: 1000,
      deadlineDays: 14,
    });
    assert.strictEqual(projRes.status, 200, `Expected 200 creating project, got ${projRes.status}`);
    const projectId = projRes.data.id;
    assert.ok(projectId, 'Project ID must be returned');

    // 2. Five freelancers submit proposals for the SAME project in USD
    console.log('2. Submitting 5 proposals from Freelancers A, B, C, D, E...');
    const submitProposal = async (token: string, freelancerId: string, freelancerName: string, bidAmount: number, deliveryDays: number, coverLetter: string) => {
      const res = await api('POST', '/api/proposals', token, {
        projectId,
        freelancerId,
        freelancerName,
        bidAmount,
        deliveryDays,
        coverLetter,
      });
      assert.strictEqual(res.status, 200, `Proposal submission failed for ${freelancerName}: ${JSON.stringify(res.data)}`);
      return res.data;
    };

    const propA = await submitProposal(tokenA, 'freelancer_A', 'Freelancer A', 500, 7, 'Proposal A: Architecture & API ($500 USD)');
    const propB = await submitProposal(tokenB, 'freelancer_B', 'Freelancer B', 450, 5, 'Proposal B: UI/UX & Storefront ($450 USD)');
    const propC = await submitProposal(tokenC, 'freelancer_C', 'Freelancer C', 600, 10, 'Proposal C: Backend & Checkout ($600 USD)');
    const propD = await submitProposal(tokenD, 'freelancer_D', 'Freelancer D', 400, 6, 'Proposal D: Basic Template ($400 USD)');
    const propE = await submitProposal(tokenE, 'freelancer_E', 'Freelancer E', 550, 8, 'Proposal E: QA & Load Testing ($550 USD)');

    // Verify all 5 proposals coexist on the same project without overwriting each other
    const allProposalsRes = await api('GET', '/api/proposals', buyerToken);
    const projectProposals = allProposalsRes.data.filter((p: any) => p.projectId === projectId);
    assert.strictEqual(projectProposals.length, 5, `Expected 5 proposals on project ${projectId}, found ${projectProposals.length}`);
    const uniqueProposalIds = new Set(projectProposals.map((p: any) => p.id));
    assert.strictEqual(uniqueProposalIds.size, 5, 'All 5 proposals must have distinct IDs');
    const uniqueWorkstreamOrderIds = new Set(projectProposals.map((p: any) => p.workstreamOrderId));
    assert.strictEqual(uniqueWorkstreamOrderIds.size, 5, 'All 5 proposals must have distinct Workstream Order IDs');
    const uniqueOfferIds = new Set(projectProposals.map((p: any) => p.offerId));
    assert.strictEqual(uniqueOfferIds.size, 5, 'All 5 proposals must have distinct WorkstreamOffer IDs');

    // Verify each Workstream has an interactive offer_created card with offerId metadata
    for (const p of [propA, propB, propC, propD, propE]) {
      const msgRes = await api('GET', `/api/messages/${p.workstreamOrderId}`, buyerToken);
      assert.strictEqual(msgRes.status, 200);
      const offerMsg = msgRes.data.find((m: any) => m.metadata?.offerId === p.offerId);
      assert.ok(offerMsg, `Workstream ${p.workstreamOrderId} must have an interactive offer card message for offer ${p.offerId}`);
      assert.strictEqual(offerMsg.metadata.action, 'offer_created');
      assert.strictEqual(offerMsg.metadata.offerKind, 'proposal');
    }

    // 3. Buyer hires MULTIPLE freelancers for the SAME project:
    //    - Accept Freelancer B ($450 USD) via POST /api/proposals/:id/accept
    //    - Accept Freelancer C ($600 USD) via POST /api/offers/:id/accept (testing Workstream card acceptance)
    //    - Decline Freelancer D ($400 USD) via POST /api/proposals/:id/decline
    //    - Accept Freelancer E ($550 USD) via POST /api/proposals/:id/accept
    //    - Leave Freelancer A ($500 USD) pending
    console.log('3. Buyer accepts B ($450), C ($600), E ($550), declines D ($400), leaves A ($500) pending...');

  const acceptB = await api('POST', `/api/proposals/${propB.id}/accept`, buyerToken);
    assert.strictEqual(acceptB.status, 200, `Accepting Proposal B failed: ${JSON.stringify(acceptB.data)}`);

    const acceptC = await api('POST', `/api/offers/${propC.offerId}/accept`, buyerToken);
    assert.strictEqual(acceptC.status, 200, `Accepting Offer C failed: ${JSON.stringify(acceptC.data)}`);

    const declineD = await api('POST', `/api/proposals/${propD.id}/decline`, buyerToken);
    assert.strictEqual(declineD.status, 200, `Declining Proposal D failed: ${JSON.stringify(declineD.data)}`);

    const acceptE = await api('POST', `/api/proposals/${propE.id}/accept`, buyerToken);
    assert.strictEqual(acceptE.status, 200, `Accepting Proposal E failed: ${JSON.stringify(acceptE.data)}`);

    // 4. Verify Proposal statuses and WorkstreamOffer statuses are 100% synchronized
    const updatedProposals = (await api('GET', '/api/proposals', buyerToken)).data;
    const getProp = (id: string) => updatedProposals.find((p: any) => p.id === id);
    const getOffer = async (orderId: string, offerId: string) => {
      const r = await api('GET', `/api/orders/${orderId}/offers`, buyerToken);
      const list = Array.isArray(r.data) ? r.data : (r.data.offers || []);
      return list.find((o: any) => o.id === offerId);
    };

    assert.strictEqual(getProp(propA.id).status, 'pending', 'Proposal A must remain pending');
    assert.strictEqual((await getOffer(propA.workstreamOrderId, propA.offerId)).status, 'pending', 'Offer A must remain pending');

    assert.strictEqual(getProp(propB.id).status, 'accepted', 'Proposal B must be accepted');
    assert.strictEqual((await getOffer(propB.workstreamOrderId, propB.offerId)).status, 'accepted', 'Offer B must be accepted');

    assert.strictEqual(getProp(propC.id).status, 'accepted', 'Proposal C must be accepted even when accepted via /api/offers/:id/accept');
    assert.strictEqual((await getOffer(propC.workstreamOrderId, propC.offerId)).status, 'accepted', 'Offer C must be accepted');

    assert.strictEqual(getProp(propD.id).status, 'rejected', 'Proposal D must be rejected');
    assert.strictEqual((await getOffer(propD.workstreamOrderId, propD.offerId)).status, 'declined', 'Offer D must be declined');

    assert.strictEqual(getProp(propE.id).status, 'accepted', 'Proposal E must be accepted');
    assert.strictEqual((await getOffer(propE.workstreamOrderId, propE.offerId)).status, 'accepted', 'Offer E must be accepted');

    // Verify Project remains open so Buyer can still accept Proposal A later if desired
    const allProjects = (await api('GET', '/api/projects', buyerToken)).data;
    const projectRecord = allProjects.find((p: any) => p.id === projectId);
    assert.strictEqual(projectRecord.status, 'open', 'Project status must remain open after hiring multiple freelancers');

    // 5. Verify 3 independent active Workstreams (B, C, E) on the SAME project
    const getOrders = async () => (await api('GET', '/api/orders', buyerToken)).data;
    let currentOrders = await getOrders();
    const getOrder = (id: string) => currentOrders.find((o: any) => o.id === id);

    const orderB = getOrder(propB.workstreamOrderId);
    const orderC = getOrder(propC.workstreamOrderId);
    const orderE = getOrder(propE.workstreamOrderId);

    assert.strictEqual(orderB.projectId, projectId);
    assert.strictEqual(orderC.projectId, projectId);
    assert.strictEqual(orderE.projectId, projectId);

    assert.strictEqual(orderB.sellerId, 'freelancer_B');
    assert.strictEqual(orderC.sellerId, 'freelancer_C');
    assert.strictEqual(orderE.sellerId, 'freelancer_E');

    assert.strictEqual(orderB.amount, 450);
    assert.strictEqual(orderC.amount, 600);
    assert.strictEqual(orderE.amount, 550);

    assert.strictEqual(orderB.status, 'funded_in_escrow');
    assert.strictEqual(orderC.status, 'funded_in_escrow');
    assert.strictEqual(orderE.status, 'funded_in_escrow');

    // 6. Verify independent lifecycle execution across Workstreams B, C, and E
    console.log('4. Testing independent delivery, escrow release, and reviews per Workstream...');

    const uploadDeliverable = async (token: string, filename: string) => {
      const res = await fetch(`${BASE}/api/workstream/upload?name=${encodeURIComponent(filename)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/pdf',
        },
        body: Buffer.from('%PDF-1.4 test deliverable content'),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200, `Upload failed for ${filename}`);
      return data.url;
    };

    const fileUrlB = await uploadDeliverable(tokenB, 'storefront_b.pdf');
    // Workstream B: Freelancer B delivers final invoice -> Buyer releases escrow -> Buyer reviews Freelancer B
    const deliverB = await api('POST', `/api/orders/${orderB.id}/deliverable`, tokenB, {
      notes: 'Completed UI/UX and storefront components.',
      files: [{ name: 'storefront_b.pdf', url: fileUrlB }],
    });
    assert.strictEqual(deliverB.status, 200, `Delivering Order B failed: ${JSON.stringify(deliverB.data)}`);
    currentOrders = await getOrders();
    assert.strictEqual(getOrder(orderB.id).status, 'delivered');
    assert.strictEqual(getOrder(orderC.id).status, 'funded_in_escrow', 'Order C must remain funded_in_escrow when Order B is delivered');
    assert.strictEqual(getOrder(orderE.id).status, 'funded_in_escrow', 'Order E must remain funded_in_escrow when Order B is delivered');

    const releaseB = await api('POST', '/api/payments/escrow/release', buyerToken, {
      orderId: orderB.id,
      requestKey: `release_${orderB.id}`,
    });
    assert.strictEqual(releaseB.status, 200, `Releasing Escrow B failed: ${JSON.stringify(releaseB.data)}`);
    currentOrders = await getOrders();
    assert.strictEqual(getOrder(orderB.id).status, 'completed');
    assert.strictEqual(getOrder(orderC.id).status, 'funded_in_escrow', 'Order C must remain funded_in_escrow after Order B is completed');
    assert.strictEqual(getOrder(orderE.id).status, 'funded_in_escrow', 'Order E must remain funded_in_escrow after Order B is completed');

    // Workstream C: Freelancer C delivers -> Buyer approves & releases -> Independent reviews on B and C
    const fileUrlC = await uploadDeliverable(tokenC, 'backend_c.pdf');
    const deliverC = await api('POST', `/api/orders/${orderC.id}/deliverable`, tokenC, {
      notes: 'Completed backend API and checkout integration.',
      files: [{ name: 'backend_c.pdf', url: fileUrlC }],
    });
    assert.strictEqual(deliverC.status, 200);
    const releaseC = await api('POST', '/api/payments/escrow/release', buyerToken, {
      orderId: orderC.id,
      requestKey: `release_${orderC.id}`,
    });
    assert.strictEqual(releaseC.status, 200);
    currentOrders = await getOrders();
    assert.strictEqual(getOrder(orderC.id).status, 'completed');
    assert.strictEqual(getOrder(orderE.id).status, 'funded_in_escrow', 'Order E must still be funded_in_escrow');

    // Submit independent reviews for Order B and Order C on the same project
    const revB = await api('POST', '/api/reviews', buyerToken, {
      orderId: orderB.id,
      targetUserId: orderB.sellerId,
      rating: 5,
      comment: 'Fantastic storefront work by Freelancer B!',
      orderTitle: orderB.title,
      projectId,
    });
    assert.strictEqual(revB.status, 201, `Review B failed: ${JSON.stringify(revB.data)}`);

    const revC = await api('POST', '/api/reviews', buyerToken, {
      orderId: orderC.id,
      targetUserId: orderC.sellerId,
      rating: 5,
      comment: 'Rock-solid backend work by Freelancer C!',
      orderTitle: orderC.title,
      projectId,
    });
    assert.strictEqual(revC.status, 201, `Review C failed: ${JSON.stringify(revC.data)}`);

    const allReviews = (await api('GET', '/api/reviews', buyerToken)).data;
    const projectReviews = allReviews.filter((r: any) => r.orderId === orderB.id || r.orderId === orderC.id);
    assert.strictEqual(projectReviews.length, 2, 'Both Freelancer B and Freelancer C must have independent review records');

    console.log('✅ All multi-proposal, multi-freelancer, and independent Workstream checks passed!');
    restoreData();
    process.exit(0);
  } catch (err) {
    restoreData();
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

main();
