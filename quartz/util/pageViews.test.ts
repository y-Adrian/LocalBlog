import assert from "node:assert/strict"
import { test } from "node:test"
import { pageViewsURL, readPageViews } from "./pageViews"

test("page view queries use the tracked pathname and an explicit all-time range", () => {
  const path = "/LocalBlog/articles/%E7%8E%AF%E5%A2%83"
  const url = new URL(pageViewsURL("https://stats.example.com/", path))
  assert.equal(decodeURIComponent(url.pathname.slice("/counter/".length, -".json".length)), path)
  assert.equal(url.searchParams.get("start"), "1970-01-01")
})

test("existing visits and formatted counts are preserved", async () => {
  assert.equal(await readPageViews(Response.json({ count: "2" })), "2")
  assert.equal(await readPageViews(Response.json({ count: "1,234" })), "1,234")
})

test("only an explicit zero count from a missing path is treated as zero", async () => {
  assert.equal(await readPageViews(Response.json({ count: "0" }, { status: 404 })), "0")
  await assert.rejects(() => readPageViews(new Response("Not found", { status: 404 })))
  await assert.rejects(() => readPageViews(Response.json({ error: "disabled" }, { status: 403 })))
  await assert.rejects(() => readPageViews(Response.json({})))
})
