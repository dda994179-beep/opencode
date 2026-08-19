/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { onMount } from "solid-js"
import { DialogSkill } from "../../../src/component/dialog-skill"
import { ConfigProvider } from "../../../src/config"
import { ClientProvider } from "../../../src/context/client"
import { DataProvider, useData } from "../../../src/context/data"
import { Keymap } from "../../../src/context/keymap"
import { ThemeProvider } from "../../../src/context/theme"
import { DialogProvider, useDialog } from "../../../src/ui/dialog"
import { ToastProvider } from "../../../src/ui/toast"
import { createApi, createEventStream, createFetch, json } from "../../fixture/tui-client"
import { emptyThemeSource } from "../../fixture/fixture"
import { TestTuiContexts } from "../../fixture/tui-environment"
import { createTuiResolvedConfig } from "../../fixture/tui-runtime"

test("toggles a skill with space without closing the dialog", async () => {
  const events = createEventStream()
  let enabled = true
  let updates = 0
  const calls = createFetch(async (url, request) => {
    const location = {
      directory: process.cwd(),
      project: { id: "proj_test", directory: process.cwd(), canonical: process.cwd() },
    }
    if (url.pathname === "/api/skill" && request.method === "GET")
      return json({
        location,
        data: [
          {
            id: "opencode",
            name: "OpenCode",
            description: "Work on OpenCode itself",
            location: "/skills/opencode/SKILL.md",
            content: "OpenCode guidance",
            enabled,
          },
        ],
      })
    if (url.pathname === "/api/skill/opencode" && request.method === "PATCH") {
      const body: unknown = await request.json()
      if (!body || typeof body !== "object" || !("enabled" in body) || typeof body.enabled !== "boolean")
        return json({}, { status: 400 })
      enabled = body.enabled
      updates++
      return new Response(null, { status: 204 })
    }
    return undefined
  }, events)

  function Probe() {
    const data = useData()
    const dialog = useDialog()
    onMount(() => {
      void data.location.skill.sync().then(() => dialog.replace(() => <DialogSkill />))
    })
    return null
  }

  const app = await testRender(
    () => (
      <TestTuiContexts>
        <ConfigProvider config={createTuiResolvedConfig()}>
          <Keymap.Provider>
            <ToastProvider>
              <ClientProvider api={createApi(calls.fetch)}>
                <DataProvider>
                  <ThemeProvider mode="dark" source={emptyThemeSource}>
                    <DialogProvider>
                      <Probe />
                    </DialogProvider>
                  </ThemeProvider>
                </DataProvider>
              </ClientProvider>
            </ToastProvider>
          </Keymap.Provider>
        </ConfigProvider>
      </TestTuiContexts>
    ),
    { width: 100, height: 30, kittyKeyboard: true },
  )
  app.renderer.start()

  try {
    await app.waitForFrame((frame) => frame.includes("[x] OpenCode") && frame.includes("Work on OpenCode itself"))
    app.mockInput.pressKey(" ")
    await app.waitForFrame((frame) => frame.includes("[ ] OpenCode") && frame.includes("Skills"))

    expect(updates).toBe(1)
  } finally {
    app.renderer.destroy()
  }
})
