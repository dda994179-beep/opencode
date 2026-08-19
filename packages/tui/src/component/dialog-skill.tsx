import { TextAttributes } from "@opentui/core"
import { DialogSelect, type DialogSelectOption } from "../ui/dialog-select"
import { createResource, createMemo, createSignal, Match, Switch } from "solid-js"
import { useDialog } from "../ui/dialog"
import { useTheme } from "../context/theme"
import { errorMessage } from "../util/error"
import { useData } from "../context/data"
import type { LocationRef } from "@opencode-ai/client"
import { useClient } from "../context/client"
import { useToast } from "../ui/toast"

export type DialogSkillProps = {
  location?: LocationRef
}

export function DialogSkill(props: DialogSkillProps) {
  const dialog = useDialog()
  const data = useData()
  const client = useClient()
  const toast = useToast()
  const theme = useTheme()
  dialog.setSize("large")

  const [loadError, setLoadError] = createSignal<unknown>()
  const [pending, setPending] = createSignal<string>()
  const [selected, setSelected] = createSignal<string>()

  const [skills, { refetch }] = createResource(() =>
    Promise.resolve()
      .then(async () => {
        setLoadError(undefined)
        const current = data.location.skill.list(props.location)
        if (current) return current
        await data.location.skill.sync(props.location)
        return data.location.skill.list(props.location) ?? []
      })
      // Catch so the rejected resource never reaches the memo below: reading
      // skills() in an errored state re-throws and tears down the dialog.
      .catch((error) => {
        setLoadError(error)
        return undefined
      }),
  )

  const showError = createMemo(() => Boolean(loadError()))

  const toggle = async (id: string) => {
    if (pending()) return
    const skill = skills()?.find((item) => item.id === id)
    if (!skill) return
    setPending(id)
    const error = await client.api.skill
      .update({
        skillID: skill.id,
        enabled: !skill.enabled,
        location: props.location
          ? { directory: props.location.directory, workspace: props.location.workspaceID }
          : undefined,
      })
      .then(
        () => undefined,
        (error) => error,
      )
    if (error) {
      toast.show({ title: "Could not update skill", message: errorMessage(error), variant: "error" })
      setPending(undefined)
      return
    }
    data.location.skill.invalidate(props.location)
    await data.location.skill.sync(props.location)
    await refetch()
    setPending(undefined)
  }

  const options = createMemo<DialogSelectOption<string>[]>(() => {
    if (showError()) return []
    const list = skills() ?? []
    const maxWidth = Math.max(0, ...list.map((s) => s.name.length))
    return list.map((skill) => ({
      title: `[${skill.enabled ? "x" : " "}] ${skill.name.padEnd(maxWidth)}`,
      description: skill.description?.replace(/\s+/g, " ").trim(),
      searchText: `${skill.id} ${skill.name} ${skill.description ?? ""}`,
      footer: pending() === skill.id ? "updating" : undefined,
      value: skill.id,
    }))
  })

  return (
    <DialogSelect
      title="Skills"
      options={options()}
      preserveSelection
      onMove={(option) => setSelected(option.value)}
      bindings={[
        {
          id: "dialog.skill.toggle",
          bind: "space",
          title: "Toggle skill",
          group: "Dialog",
          run: () => {
            const first = options()[0]?.value
            const id = selected() ?? first
            if (id) void toggle(id)
          },
        },
      ]}
      footerHints={[{ title: "toggle", label: "space" }]}
      renderFilter={!showError() && !skills.loading}
      locked={showError() || skills.loading}
      emptyView={
        <Switch
          fallback={
            <box paddingLeft={4} paddingRight={4}>
              <text fg={theme.text.subdued}>No skills available</text>
            </box>
          }
        >
          <Match when={showError()}>
            <box paddingLeft={4} paddingRight={4}>
              <text fg={theme.text.feedback.error.default} attributes={TextAttributes.BOLD}>
                Could not load skills
              </text>
              <text fg={theme.text.subdued}>{errorMessage(loadError())}</text>
              <text fg={theme.text.subdued}>Close and reopen Skills to try again.</text>
            </box>
          </Match>
          <Match when={skills.loading}>
            <box paddingLeft={4} paddingRight={4}>
              <text fg={theme.text.subdued}>Loading skills…</text>
            </box>
          </Match>
        </Switch>
      }
      noMatchView={
        <box paddingLeft={4} paddingRight={4}>
          <text fg={theme.text.subdued}>No skills found</text>
        </box>
      }
    />
  )
}
