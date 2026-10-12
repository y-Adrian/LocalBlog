import assert from "node:assert/strict"
import { test } from "node:test"
import { fetchCanonical, resolveNavigationURL } from "./util"

function responseAt(url: string, body: string) {
  const response = new Response(body, { headers: { "content-type": "text/html" } })
  Object.defineProperty(response, "url", { value: url })
  return response
}

test("migrated pages resolve links from their canonical address under the project path", () => {
  const requested = new URL("https://example.com/LocalBlog/old-network/#storage")
  const response = responseAt("https://example.com/LocalBlog/knowledge/network/", "")
  const destination = resolveNavigationURL(requested, response)
  assert.equal(destination.href, "https://example.com/LocalBlog/knowledge/network/#storage")
  assert.equal(
    new URL("../../knowledge/linux/storage", destination).href,
    "https://example.com/LocalBlog/knowledge/linux/storage",
  )
})

test("canonical redirects are relative to the HTTP response's final directory address", async (t) => {
  const requested = new URL("https://example.com/LocalBlog/old-network")
  const alias = responseAt(
    "https://example.com/LocalBlog/old-network/",
    '<link rel="canonical" href="../knowledge/network/">',
  )
  const target = responseAt("https://example.com/LocalBlog/knowledge/network/", "<p>Content</p>")
  const calls: string[] = []
  t.mock.method(globalThis, "fetch", async (input: string) => {
    calls.push(String(input))
    return calls.length === 1 ? alias : target
  })
  assert.equal(await fetchCanonical(requested), target)
  assert.deepEqual(calls, [requested.href, "https://example.com/LocalBlog/knowledge/network/"])
})

test("pages without a canonical redirect keep the fetched response", async (t) => {
  const requested = new URL("https://example.com/LocalBlog/knowledge/network/")
  const response = responseAt(requested.href, "<p>Content</p>")
  const fetchMock = t.mock.method(globalThis, "fetch", async () => response)
  assert.equal(await fetchCanonical(requested), response)
  assert.equal(fetchMock.mock.callCount(), 1)
})
