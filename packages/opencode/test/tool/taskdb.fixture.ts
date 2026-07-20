import path from "path"
import { Effect, Layer } from "effect"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import { FetchHttpClient } from "effect/unstable/http"
import { Agent } from "@/agent/agent"
import { BackgroundJob } from "@/background/job"
import { Bus } from "@/bus"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { Format } from "@/format"
import { Git } from "@/git"
import { LSP } from "@/lsp/lsp"
import { Plugin } from "@/plugin"
import { Provider } from "@/provider/provider"
import { Question } from "@/question"
import { Reference } from "@/reference/reference"
import { RepositoryCache } from "@/reference/repository-cache"
import { Session } from "@/session/session"
import { SessionStatus } from "@/session/status"
import { Instruction } from "@/session/instruction"
import { Todo } from "@/session/todo"
import { Skill } from "@/skill"
import { AugustTask } from "@/augusttask/service/augusttask-service"
import { ToolRegistry } from "@/tool/registry"
import * as Truncate from "@/tool/truncate"
import { Ripgrep } from "@/file/ripgrep"
import { TestConfig } from "../fixture/config"
import { InstanceState } from "@/effect/instance-state"

export const registryLayer = () =>
  ToolRegistry.layer
    .pipe(
      Layer.provide(
        TestConfig.layer({
          directories: () => InstanceState.directory.pipe(Effect.map((dir) => [path.join(dir, ".opencode")])),
        }),
      ),
      Layer.provide(Plugin.defaultLayer),
      Layer.provide(Question.defaultLayer),
      Layer.provide(Layer.mergeAll(Todo.defaultLayer, AugustTask.defaultLayer)),
      Layer.provide(Skill.defaultLayer),
      Layer.provide(Agent.defaultLayer),
      Layer.provide(Session.defaultLayer),
      Layer.provide(Layer.mergeAll(SessionStatus.defaultLayer, BackgroundJob.defaultLayer)),
      Layer.provide(Provider.defaultLayer),
      Layer.provide(Layer.mergeAll(Git.defaultLayer, RepositoryCache.defaultLayer)),
      Layer.provide(Reference.defaultLayer),
      Layer.provide(LSP.defaultLayer),
      Layer.provide(Instruction.defaultLayer),
      Layer.provide(AppFileSystem.defaultLayer),
      Layer.provide(Bus.layer),
      Layer.provide(FetchHttpClient.layer),
      Layer.provide(Format.defaultLayer),
      Layer.provide(CrossSpawnSpawner.defaultLayer),
      Layer.provide(Ripgrep.defaultLayer),
      Layer.provide(Truncate.defaultLayer),
    )
    .pipe(Layer.provide(RuntimeFlags.defaultLayer))
