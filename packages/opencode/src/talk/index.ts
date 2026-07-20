import { Effect } from "effect"
import { createTalkArtifactRun, type TalkArtifactRun } from "./artifact"
import { buildTalkerInstructions } from "./prompt"
import { buildSessionUpdate } from "./realtime"
import { runTalkRealtime, type TalkDelegateInput } from "./runner"

export interface TalkStartupInput {
  directory: string
  sessionID: string
  model: string
  voice: string
  inputRate: number
  artifactRoot: string
  now: Date
}

export interface TalkRunInput extends TalkStartupInput {
  apiKey: string
  allowNonDarwin?: boolean
  delegate?: (input: TalkDelegateInput) => Promise<string>
}

export function isDryRun(args: { dryRun?: boolean }) {
  return args.dryRun === true
}

export function buildTalkStartup(input: TalkStartupInput) {
  const instructions = buildTalkerInstructions({ directory: input.directory, sessionID: input.sessionID })
  return {
    instructions,
    sessionUpdate: buildSessionUpdate({
      instructions,
      voice: input.voice,
      inputRate: input.inputRate,
      model: input.model,
    }),
    artifact: createTalkArtifactRun({
      root: input.artifactRoot,
      now: input.now,
      sessionID: input.sessionID,
      directory: input.directory,
    }),
    manifest: {
      model: input.model,
      voice: input.voice,
      inputRate: input.inputRate,
      mode: "talk",
    },
  }
}

export const runTalk = Effect.fn("Talk.run")(function* (input: TalkRunInput & { artifact: TalkArtifactRun }) {
  return yield* Effect.tryPromise({
    try: () => runTalkRealtime(input),
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  })
})

export * as Talk from "."
