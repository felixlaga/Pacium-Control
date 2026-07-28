# Risk register

Review at every milestone.

| ID   | Risk                                               | Likelihood |      Impact | Mitigation                                                                                                       | Trigger                              |
| ---- | -------------------------------------------------- | ---------: | ----------: | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| R-01 | PTY behavior differs by OS/runtime version         |     Medium |        High | supported-platform matrix, real integration fixtures                                                             | input/resize/signal mismatch         |
| R-02 | Browser refresh duplicates input                   |     Medium |        High | session epochs, no automatic retry, contract tests                                                               | repeated command/text                |
| R-03 | Local-server exit unexpectedly loses work          |       High | Medium/High | honest direct-PTY limitation, relaunch manifest, optional tmux later                                             | operator expected survival           |
| R-04 | Slow client causes unbounded output memory         |     Medium |        High | bounded buffers, resync state, PC-072 RSS/heap soak budgets                                                      | growing RSS or lag                   |
| R-05 | Terminal focus sends shortcuts to wrong target     |     Medium |        High | explicit capture state, escape chord, browser tests                                                              | accidental command/input             |
| R-06 | Two browser clients both write                     |     Medium |        High | one input owner per session, visible ownership                                                                   | interleaved input                    |
| R-07 | Terminal escape sequence attacks UI                |     Medium |        High | xterm boundary, CSP, link/title/clipboard hardening                                                              | unsafe navigation or DOM effect      |
| R-08 | Local server binds beyond loopback                 |        Low |    Critical | fail-closed startup validation and reachability tests                                                            | non-loopback listener                |
| R-09 | Malicious page controls localhost shell            |     Medium |    Critical | Origin validation, local token, bounded protocol                                                                 | cross-origin terminal request        |
| R-10 | Agent state inference misleads operator            |       High |      Medium | source/confidence/freshness and conservative reducer                                                             | false working/done state             |
| R-11 | Notifications become noisy                         |     Medium |      Medium | attention-only defaults, mute, pilot metrics                                                                     | notification fatigue                 |
| R-12 | Git diff overwhelms UI or memory                   |     Medium |      Medium | size caps, lazy loading, binary/large states                                                                     | large repository/diff                |
| R-13 | Verification runs arbitrary unsafe command         |     Medium |        High | explicit local presets, preview, timeout, no remote caller                                                       | unexpected command                   |
| R-14 | Queue rewrite creates duplicate decision           |       High |        High | source identity, hash/provenance, idempotent delivery                                                            | answer delivered twice               |
| R-15 | Question is mistaken for approval                  |     Medium |    Critical | separate schema, UI, confirmation, tests                                                                         | privileged action from answer        |
| R-16 | Queue content is executed                          | Low/Medium |    Critical | parser treats text only as data                                                                                  | command sourced from file            |
| R-17 | Provider update breaks observer                    |       High |      Medium | fixtures, capability/version detection, terminal fallback                                                        | parse failures                       |
| R-18 | Native event view hides terminal truth             |     Medium |      Medium | raw terminal always available, source labels                                                                     | contradictory states                 |
| R-19 | Scope expands back into remote platform            |     Medium |        High | ADR-0013–0015, roadmap gates, deferred list                                                                      | auth/multi-host work before MVP      |
| R-20 | UI becomes decorative or cluttered                 |     Medium |        High | design tokens, hierarchy review, realistic density fixtures                                                      | main terminal loses focus            |
| R-21 | Native PTY dependency complicates install          |     Medium |        High | patched source build, pinned Node/toolchains, packaged arm64 and Ubuntu x64 canaries, PC-076 clean-account gate  | build/load failure on clean machine  |
| R-22 | Process-group cleanup kills wrong process          | Low/Medium |    Critical | isolated groups, PID lineage, integration tests                                                                  | unrelated process affected           |
| R-23 | Persisted logs/state contain secrets               |     Medium |        High | bounded metadata, no raw bytes/env, secret scans                                                                 | secret scan alert                    |
| R-24 | Optional tmux becomes hidden requirement           |     Medium |      Medium | direct PTY release gate, capability labels                                                                       | core test depends on tmux            |
| R-25 | Linear inspiration becomes imitation               | Low/Medium |      Medium | principles not pixels, original tokens/brand                                                                     | copied visual identity               |
| R-26 | Support export leaks sensitive local content       |        Low |    Critical | strict allowlist, fixed bounds, preview, hostile-field exclusion                                                 | content canary in JSON               |
| R-27 | Package lifecycle replaces or removes foreign data |        Low |    Critical | exact bundle/link identity, absolute destinations, sibling staging/rollback, active lease, preservation canaries | foreign target or lost state         |
| R-28 | Linux support claim exceeds verified host boundary |     Medium |        High | ADR-0017 exact Ubuntu 24.04 x64 scope, immutable CI pins, native/package/browser gates                           | unverified distro/architecture claim |

## Review questions

1. Which risk triggered?
2. Which mitigation has evidence?
3. Which new risk appeared?
4. Does the next milestone expand trust or persistence?
5. Is the local terminal experience still the critical path?
