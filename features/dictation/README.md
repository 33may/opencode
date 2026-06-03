# August dictation hotkey

Goal: make a local macOS hotkey capture a short voice note, transcribe it with OpenAI, and copy the transcript into the clipboard.

## Flow

```text
Ctrl-O first press  ->  scripts/august-dictation toggle  ->  ffmpeg starts recording microphone audio
Ctrl-O second press ->  scripts/august-dictation toggle  ->  ffmpeg stops, OpenAI transcribes, pbcopy receives text
                                                     ->  macOS notifications show start/stop/done
```

The feature lives outside upstream OpenCode internals. It is a repo-local August script plus optional Karabiner configuration, so upstream merges should not need conflict resolution.

## Install

Requirements:

- macOS
- [Karabiner-Elements](https://karabiner-elements.pqrs.org/) for the Ctrl-O hotkey
- `ffmpeg` on `PATH`, at `/opt/homebrew/bin/ffmpeg`, at `/usr/local/bin/ffmpeg`, or configured with `AUGUST_DICTATION_FFMPEG`
- `OPENAI_API_KEY` in the environment or in the global secrets file at `~/.config/secrets.env`

Install or refresh the Karabiner rule:

```bash
/path/to/august/scripts/august-dictation install-karabiner
```

Karabiner is configured to run:

```bash
/path/to/august/scripts/august-dictation toggle
```

If Karabiner does not load the rule immediately, open Karabiner-Elements and reload the complex modifications profile.

## Use

Press `Control` + `O` once to start recording. Press it again to stop. The script sends the audio file to OpenAI's audio transcription endpoint, copies the returned text with `pbcopy`, and shows macOS notifications at start, stop, and completion.

The completion notification includes a short transcript preview and confirms that the full transcript was copied to the clipboard. If transcription fails, the script shows a failure notification instead of silently disappearing after the "Transcribing" message.

English and Russian transcripts are kept as UTF-8 before they are sent to macOS notifications or `pbcopy`. Karabiner often launches commands without a UTF-8 locale, so the script forces `LANG`, `LC_ALL`, and `LC_CTYPE` to a UTF-8 locale for text-facing child processes. This prevents Russian text from turning into MacRoman mojibake such as `–ú–∞...`.

Manual commands:

```bash
scripts/august-dictation start
scripts/august-dictation stop
scripts/august-dictation status
```

## Configuration

```bash
export OPENAI_API_KEY=...
export AUGUST_DICTATION_MODEL=gpt-4o-transcribe # default
export AUGUST_DICTATION_INPUT=:0                # ffmpeg avfoundation input
export AUGUST_DICTATION_FFMPEG=/opt/homebrew/bin/ffmpeg
export AUGUST_DICTATION_TIMEOUT_MS=60000        # OpenAI transcription timeout
export AUGUST_DICTATION_STATE_DIR=~/.local/state/august/dictation
```

Karabiner's `shell_command` does not always inherit an interactive terminal environment. The dictation script therefore reads `OPENAI_API_KEY` from `~/.config/secrets.env` when the environment does not provide it. This matches August's global secret convention:

```bash
# ~/.config/secrets.env
export OPENAI_API_KEY="..."
```

You can override the secrets file path with `AUGUST_SECRETS_ENV=/path/to/secrets.env`. `launchctl setenv OPENAI_API_KEY "$OPENAI_API_KEY"` also works if you prefer exposing the key directly to Karabiner.

## Compatibility notes

- The recorder uses macOS `avfoundation`; Linux and Windows are intentionally unsupported for now.
- Audio capture defaults to `:0`, the first avfoundation audio input. Run `ffmpeg -f avfoundation -list_devices true -i ""` to find another input and set `AUGUST_DICTATION_INPUT`.
- Karabiner does not always inherit the terminal `PATH`; the script checks common Homebrew ffmpeg locations and refuses to create recording state when the recorder process does not start.
- State and temporary recordings stay under `~/.local/state/august/dictation` by default and are not committed to the repo.
