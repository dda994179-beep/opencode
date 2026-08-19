import { Skill } from "@opencode-ai/core/skill"
import { HttpApiBuilder, HttpApiSchema } from "effect/unstable/httpapi"
import { SkillNotFoundError } from "@opencode-ai/protocol/errors"
import { Effect } from "effect"
import { Api } from "../api"
import { response } from "../location"

export const SkillHandler = HttpApiBuilder.group(Api, "server.skill", (handlers) =>
  handlers
    .handle("skill.list", () => response(Skill.Service.use((skill) => skill.status())))
    .handle(
      "skill.update",
      Effect.fn(function* (ctx) {
        const skill = yield* Skill.Service
        yield* skill.setEnabled(ctx.params.skillID, ctx.payload.enabled).pipe(
          Effect.catchTag(
            "Skill.NotFoundError",
            () =>
              new SkillNotFoundError({
                skill: ctx.params.skillID,
                message: `Skill not found: ${ctx.params.skillID}`,
              }),
          ),
        )
        return HttpApiSchema.NoContent.make()
      }),
    ),
)
