import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://frontend:3000";
const evidenceFile = new URL("../artifacts/smoke.json", import.meta.url);

async function request(path, { cookie, ...options } = {}) {
  const headers = new Headers(options.headers);
  if (cookie) headers.set("Cookie", cookie);
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

async function login(userId) {
  const response = await request("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  assert.equal(response.status, 200);
  const cookieHeader = response.headers.get("set-cookie");
  assert.match(cookieHeader, /HttpOnly/i);
  assert.match(cookieHeader, /SameSite=Lax/i);
  assert.match(cookieHeader, /Path=\//i);
  const cookie = cookieHeader.split(";")[0];
  const session = await request("/api/session", { cookie });
  assert.equal((await session.json()).id, userId);
  return cookie;
}

async function json(path, cookie) {
  const response = await request(path, { cookie });
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  return response.json();
}

async function imageBytes(path, cookie) {
  const response = await request(path, { cookie });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-type"), /^image\//);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length > 0);
  return bytes;
}

if (process.argv.includes("--verify-persistence")) {
  const saved = JSON.parse(await readFile(evidenceFile, "utf8"));
  const cookie = await login("demo-alice");
  assert.ok(saved.snapshots && saved.resultBytes, "Run smoke without --verify-persistence before checking this version");
  assert.deepEqual(await imageBytes(saved.assetUrl, cookie),
    await readFile(new URL("../assets/demo/inputs/mountain.png", import.meta.url)));
  assert.deepEqual(await imageBytes(saved.resultUrl, cookie), Buffer.from(saved.resultBytes, "base64"));
  for (const snapshot of saved.snapshots) {
    assert.deepEqual(await json(`/api/tasks/${snapshot.id}`, cookie), snapshot);
  }
  assert.equal((await json("/api/templates")).items.length, 4);
  console.log("PASS: container recreation retained history, files and four template seeds");
} else {
  assert.equal((await request("/")).status, 200);
  assert.equal((await json("/api/health")).status, "UP");
  assert.equal((await json("/api/templates")).items.length, 4);
  assert.equal((await json("/api/categories")).items.length, 2);
  assert.equal((await request("/demo/covers/mountain-card.svg")).status, 200);
  assert.equal((await request("/demo/templates.json")).status, 404);
  let alice = await login("demo-alice");
  const bob = await login("demo-bob");
  const image = await readFile(new URL("../assets/demo/inputs/mountain.png", import.meta.url));
  const form = new FormData();
  form.set("templateId", "mountain-card");
  form.set("file", new Blob([image], { type: "image/png" }), "mountain.png");
  const uploaded = await request("/api/assets", { method: "POST", cookie: alice, body: form });
  assert.equal(uploaded.status, 201);
  const asset = await uploaded.json();
  assert.deepEqual(await imageBytes(asset.previewUrl, alice), image);
  assert.equal((await request(asset.previewUrl, { cookie: bob })).status, 404);

  async function create(simulation) {
    const response = await request("/api/tasks", {
      method: "POST",
      cookie: alice,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: "mountain-card", assetIds: [asset.id], simulation }),
    });
    assert.equal(response.status, 202);
    const task = await response.json();
    assert.equal(response.headers.get("location"), `/api/tasks/${task.id}`);
    return task;
  }

  const successIds = [];
  for (let index = 0; index < 3; index++) {
    successIds.push((await create({ stepDelayMs: 1000 })).id);
  }
  const observed = await json(`/api/tasks/status?ids=${successIds.join(",")}`, alice);
  assert.deepEqual(observed.items.map((task) => task.status), ["RUNNING", "RUNNING", "QUEUED"]);
  assert.equal((await request(`/api/tasks/${successIds[0]}`, { cookie: bob })).status, 404);
  assert.equal((await request("/api/session", { method: "DELETE", cookie: alice })).status, 204);

  // 此段刻意不查询，验证退出会话后后台仍完成两个执行批次。
  await delay(8000);
  alice = await login("demo-alice");
  for (const id of successIds) {
    const task = await json(`/api/tasks/${id}`, alice);
    assert.equal(task.status, "SUCCEEDED");
    assert.deepEqual(task.steps.map((step) => step.status), ["SUCCEEDED", "SUCCEEDED", "SUCCEEDED"]);
  }
  const failed = await create({ stepDelayMs: 0, failAtStage: "MOCK_GENERATION" });
  const deadline = Date.now() + 10000;
  let failure;
  do {
    failure = await json(`/api/tasks/${failed.id}`, alice);
    if (failure.status === "FAILED") break;
    assert.ok(Date.now() < deadline, "failure task timed out");
    await delay(100);
  } while (true);
  assert.equal(failure.failure.stage, "MOCK_GENERATION");
  assert.deepEqual(failure.steps.map((step) => step.status), ["SUCCEEDED", "FAILED", "SKIPPED"]);
  const page = await json("/api/tasks?limit=2", alice);
  assert.equal(page.items.length, 2);
  assert.ok(page.nextCursor);
  assert.equal((await json("/api/tasks/active", alice)).items.length, 0);

  const resultUrl = `/api/tasks/${successIds[0]}/result`;
  const evidence = {
    checkedAt: new Date().toISOString(),
    successIds,
    failedId: failed.id,
    assetUrl: asset.previewUrl,
    resultUrl,
    resultBytes: (await imageBytes(resultUrl, alice)).toString("base64"),
    snapshots: await Promise.all([...successIds, failed.id].map((id) => json(`/api/tasks/${id}`, alice))),
  };
  await mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
  await writeFile(evidenceFile, JSON.stringify(evidence, null, 2));
  console.log("PASS: Next.js proxy, cookie, multipart, binary, two workers, queue, logout, success, failure and ownership");
}
