import { Effect } from "effect"
import { Agent } from "@/agent/agent"
import { InstanceRef } from "@/effect/instance-ref"
import { MessageV2 } from "@/session/message-v2"
import { SessionPrompt } from "@/session/prompt"
import { appendJsonl, writeManifest } from "@/talk/artifact"
import { checkSoxAvailable } from "@/talk/audio"
import { buildTalkStartup, isDryRun, runTalk } from "@/talk"
import { buildTechnicianPrompt, createTalkSession } from "@/talk/session"
import { which } from "@/util/which"
import { effectCmd, fail } from "../effect-cmd"
import { UI } from "../ui"

export const TalkCommand = effectCmd({
  command: "talk",
  describe: "start an August voice call",
  builder: (yargs) =>
    yargs
      .option("model", {
        describe: "OpenAI realtime model",
        type: "string",
        default: "gpt-realtime-2",
      })
      .option("voice", {
        describe: "OpenAI realtime voice",
        type: "string",
        default: "marin",
      })
      .option("dry-run", {
        describe: "write startup artifacts without opening audio or realtime",
        type: "boolean",
      })
      .option("artifact-root", {
        describe: "root directory for August talk artifacts",
        type: "string",
      })
      .option("allow-non-darwin", {
        describe: "allow running the audio preflight on non-macOS platforms",
        type: "boolean",
      }),
  handler: Effect.fn("Cli.talk")(function* (args) {
    const ctx = yield* InstanceRef
    if (!ctx) return yield* fail("talk requires a project instance")

    const now = new Date()
    const session = yield* createTalkSession({ now })
    const input = {
      directory: ctx.directory,
      sessionID: session.id,
      model: args.model,
      voice: args.voice,
      inputRate: 24000,
      artifactRoot: args["artifact-root"] ?? ctx.directory,
      now,
    }
    const startup = buildTalkStartup(input)

    if (isDryRun({ dryRun: args["dry-run"] })) {
      yield* Effect.promise(() => writeManifest(startup.artifact, { ...startup.manifest, dryRun: true }))
      yield* Effect.promise(() =>
        appendJsonl(startup.artifact.events, {
          role: "system",
          source: "runtime",
          text: "August talk dry-run setup complete.",
          time: new Date().toISOString(),
          sessionID: session.id,
        }),
      )
      UI.println(`August talk dry-run artifacts: ${startup.artifact.dir}`)
      return
    }

    if (!process.env.OPENAI_API_KEY) return yield* fail("OPENAI_API_KEY is required for august talk")
    if (process.platform !== "darwin" && !args["allow-non-darwin"]) {
      return yield* fail("august talk audio is macOS-first; pass --allow-non-darwin to bypass")
    }

    const sox = yield* Effect.promise(() => checkSoxAvailable((command) => which(command) !== null))
    if (!sox.ok) return yield* fail(sox.message)

    yield* Effect.promise(() => writeManifest(startup.artifact, { ...startup.manifest, dryRun: false }))
    const prompt = yield* SessionPrompt.Service
    const agent = yield* Agent.Service
    const agentName = yield* agent.defaultAgent()

    yield* runTalk({
      ...input,
      artifact: startup.artifact,
      apiKey: process.env.OPENAI_API_KEY,
      allowNonDarwin: args["allow-non-darwin"],
      delegate: (request) =>
        Effect.runPromise(
          prompt.prompt({
            sessionID: session.id,
            agent: agentName,
            parts: [{ type: "text", text: buildTechnicianPrompt(request) }],
          }),
        ).then(textFromMessage),
    }).pipe(
      Effect.catch((error) => fail(error.message)),
    )
  }),
})

function textFromMessage(message: MessageV2.WithParts) {
  return message.parts
    .filter((part): part is MessageV2.TextPart => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim() || "August delegated task completed."
}
