# Philosophy

## 1. Improve the terminal before abstracting it

The terminal is already where the work happens. Pacium should make it calmer, better organized, and easier to supervise before replacing any part with structured views.

## 2. Attention is the scarce resource

The session list should answer: what needs me now? Working bytes are not automatically a notification. Completion, failure, waiting, and uncertainty must be meaningful.

## 3. Preserve source truth

- PTY/process state owns whether a local process exists.
- Git owns code state.
- Provider-native events own provider semantics.
- Queue files own legacy queue input.
- Pacium owns local organization, attention, decisions, and presentation.

## 4. Calm design is functional

Strong hierarchy, compact density, predictable actions, keyboard navigation, and restrained color reduce context-switching. The interface should feel deliberate under twenty sessions, not only beautiful when empty.

## 5. Browser failure should be boring

Refreshing or closing a browser tab must not terminate a live PTY. Reconnect should restore enough visible state to continue. If the local server dies and direct PTYs end, the UI says so plainly.

## 6. Inference is not confirmation

Terminal movement may suggest activity; it does not prove useful work. Process existence may prove liveness; it does not prove progress. Show source, confidence, and freshness.

## 7. Local does not mean careless

An unrelated webpage must not control a localhost shell. Terminal output must not inject application UI. Tokens, origins, paths, buffers, and process targets remain explicit.

## 8. Keep state small

Do not duplicate terminal transcripts, Git history, provider state, or workflow concepts without a visible product need. Small inspectable JSON is enough for preferences, session organization, queue provenance, and decisions.

## 9. Pacium is a focused mode

Meta, Orchestrator, workers, and the queue deserve a tailored interface. They do not justify a second application shell or a universal orchestration platform.

## 10. Evidence outranks narration

Changed files, diffs, commits, checks, process exit, queue provenance, and provider events are evidence. Summaries explain evidence; they do not replace it.

## 11. Earn complexity

The sequence is:

1. make one terminal excellent;
2. manage several;
3. make attention reliable;
4. add context;
5. add Pacium;
6. enrich with native events;
7. add optional durability.

Remote access stays narrow: optional Tailscale Serve to the loopback application. Generalized workflows still require demonstrated need.
