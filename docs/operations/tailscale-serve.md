# Optional Tailscale Serve access

Pacium Control can accept one tailnet-only HTTPS origin through Tailscale
Serve. This is an optional single-operator transport to the same loopback
Pacium process and the same host-owned PTYs. It is not a public deployment,
application account system, remote host, or multi-user control plane.

The active boundary is:

```text
Allowlisted tailnet user
        ↕ HTTPS / WSS on tcp:443
Tailscale grants + Tailscale Serve
        ↕ HTTP / WS on loopback
Pacium at 127.0.0.1:4174
        ↕
Local PTYs, repositories, queue files, and optional tmux
```

Read ADR-0016 and `SECURITY.md` before enabling this mode. Current Tailscale
commands and header behavior should be rechecked against the
[Serve documentation](https://tailscale.com/docs/features/tailscale-serve)
before a release.

## Security contract

- Pacium always listens on `127.0.0.1`. Remote mode cannot change that bind.
- Tailscale Serve is the only accepted proxy. Another proxy is unsupported.
- Tailscale Funnel is prohibited because it is public.
- The configured Origin must be one canonical
  `https://<node>.<tailnet>.ts.net` origin with no port or path.
- The application allowlist contains exact Tailscale login values, not display
  names, devices, IP addresses, groups, or inferred identities.
- Tailscale grants restrict network reachability. Pacium then checks the
  Serve-provided login against its own allowlist.
- Protected HTTP and WebSocket transports still require Pacium's ephemeral
  process token.
- Requests without a user login are denied. This includes traffic from tagged
  source devices because Serve does not add user identity headers for them.
- Provider credentials, Tailscale keys, certificates, grants, identity, and
  the Pacium token are never stored in Pacium state.

Tailscale documents that Serve removes inbound Tailscale identity headers
before adding the authenticated user's headers to the loopback proxy request.
Pacium trusts `Tailscale-User-Login` only for the exact configured Serve
Host/Origin while remaining loopback-bound. A process already running as the
same local OS user remains inside Pacium's accepted host-local trust boundary.

## 1. Confirm prerequisites

On the Pacium host:

1. Install and sign in to Tailscale under the intended tailnet.
2. Enable MagicDNS and HTTPS certificates for that tailnet.
3. Confirm the node's current `*.ts.net` DNS name.
4. Confirm the Pacium operator's exact login as Tailscale reports it.
5. Review the tailnet policy. A default allow-all policy is not a
   least-privilege Pacium grant.
6. Confirm port `4174` is available on loopback.

Do not configure Funnel, a public DNS record, a router port-forward, a LAN
listener, or a direct Tailscale listener.

## 2. Configure Pacium

Remote mode is all-or-nothing:

```sh
export PACIUM_TAILSCALE_ORIGIN="https://pacium-host.example-tailnet.ts.net"
export PACIUM_TAILSCALE_OPERATOR_LOGINS="owner@example.com"
```

Use the actual canonical Serve URL and the exact login value. Multiple explicit
operators may be comma-separated, up to the documented bound, but PC-077
remains a single-operator product and does not add shared input ownership.

Both variables absent means local-only. If only one exists, either value is
empty, the Origin is not canonical HTTPS under `ts.net`, or a login is unsafe,
Pacium rejects startup before listening.

Start Pacium normally. Its output must still report:

```text
Pacium Control is running at http://127.0.0.1:4174
```

On macOS, inspect the listener without exposing content:

```sh
lsof -nP -iTCP:4174 -sTCP:LISTEN
```

The listening address must be `127.0.0.1:4174`, never `*`, a LAN address, or a
Tailscale address.

## 3. Configure a least-privilege grant

Tailnet policies are HuJSON documents and must be merged with the existing
reviewed policy. Do not replace a real policy with this excerpt.

One concrete pattern names the Pacium host's current Tailscale IP in `hosts`,
grants only the intended login access to HTTPS, and locks the rule with policy
tests:

```jsonc
{
  "hosts": {
    "pacium-control-host": "100.101.102.103",
  },
  "grants": [
    {
      "src": ["owner@example.com"],
      "dst": ["pacium-control-host"],
      "ip": ["tcp:443"],
    },
  ],
  "tests": [
    {
      "src": "owner@example.com",
      "proto": "tcp",
      "accept": ["pacium-control-host:443"],
    },
    {
      "src": "unlisted@example.com",
      "proto": "tcp",
      "deny": ["pacium-control-host:443"],
    },
  ],
}
```

Replace the example IP and logins. If the existing policy uses a reviewed
destination tag or group, use that established selector instead. Review other
grants too: another broad rule can still make the negative test fail or make
the intended restriction ineffective.

Tailscale recommends grants for new policies and documents current selector and
test syntax in its
[tailnet policy reference](https://tailscale.com/docs/reference/syntax/policy-file).
Use the admin-console policy preview and do not apply a change until both the
positive and negative cases are understood.

## 4. Start Serve

With Pacium already listening on loopback:

```sh
tailscale serve --bg 4174
tailscale serve status
```

The status must describe one tailnet-only HTTPS URL proxying `/` to
`http://127.0.0.1:4174`. Port forwarding through Serve does not require Pacium
to bind to the tailnet.

Also inspect Funnel:

```sh
tailscale funnel status
```

There must be no Funnel route to Pacium. If a Funnel route exists, disable it
with the exact matching `tailscale funnel ... off` command described by the
current Tailscale CLI before continuing. Do not use a broad reset when the node
owns unrelated routes.

## 5. Validate before use

These are manual provider/network checks. Local automated tests do not prove
them.

### Allowed operator

From an allowlisted user-associated tailnet device:

1. Open the exact configured HTTPS URL.
2. Confirm the header says `Tailscale · <exact login> · connected`.
3. Create a disposable shell PTY.
4. Send harmless input and confirm output.
5. Resize the terminal.
6. Refresh the browser and reattach to the same live PTY.
7. Close the browser and confirm the PTY remains alive.
8. Close the disposable PTY explicitly.

Do not use a production Meta or Orchestrator session as the first canary.

### Denied identities

Verify each case independently:

- a tailnet user not present in the network grant is denied before Pacium;
- a user reachable through another grant but absent from
  `PACIUM_TAILSCALE_OPERATOR_LOGINS` receives only a generic forbidden
  response;
- a tagged source device without a user identity is denied;
- an allowed user using another Host or Origin is denied;
- a missing or stale Pacium token cannot open a protected HTTP connection or
  WebSocket.

No denial should reveal the token, allowlist, terminal inventory, alternate
login, or provider content.

### No direct or public reachability

From another device, verify the Pacium backend port is unreachable through:

- the host's LAN address on port `4174`;
- the host's Tailscale IP on port `4174`;
- the host's public IP on port `4174`.

From a device not connected to the tailnet, verify the Serve HTTPS URL cannot
load. Re-run `tailscale serve status` and `tailscale funnel status`; the
configured route must be Serve-only.

Record device, user, time, Tailscale client version, policy revision, commands,
and results as release evidence. Do not store tokens, full terminal output, or
environment dumps.

## Revocation

For immediate remote shutdown without stopping Pacium or its PTYs:

```sh
tailscale serve off
```

Then confirm `tailscale serve status` no longer exposes the route and that the
remote browser cannot reconnect. Local Pacium access and running PTYs remain
available.

To revoke one user while retaining Serve for another:

1. remove the user from the Tailscale grant first;
2. validate the negative policy test and apply the policy;
3. confirm the existing connection stops passing traffic and cannot reconnect;
4. remove the login from `PACIUM_TAILSCALE_OPERATOR_LOGINS` for the next Pacium
   start.

Pacium's application allowlist is startup configuration. Changing it requires
a future Pacium restart, which follows the existing direct-PTY server lifecycle.
Use the outer grant or `tailscale serve off` for immediate non-PTY-killing
revocation.

## Return to local-only mode

1. Run `tailscale serve off`.
2. Confirm the Serve route and remote browser access are gone.
3. Remove both `PACIUM_TAILSCALE_ORIGIN` and
   `PACIUM_TAILSCALE_OPERATOR_LOGINS` from the next startup environment.
4. At the next planned Pacium restart, confirm startup reports only the
   loopback URL.
5. Confirm localhost bootstrap, terminal creation, refresh/reconnect, and
   explicit terminal closure.

No Pacium state migration or deletion is needed. Never delete PTYs, queue
state, workspace configuration, repositories, or worktrees merely to disable
Serve.

## Failure guide

| Symptom                                | Meaning                                                                   | Safe action                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Pacium rejects startup                 | Remote environment is incomplete or invalid                               | Fix both values or remove both                                              |
| Serve URL does not load                | Serve, DNS, certificate, grant, or tailnet path is unavailable            | Inspect Tailscale externally; localhost remains usable                      |
| Generic 403 at Serve URL               | Host, Origin, login, fetch metadata, or token failed Pacium authorization | Check exact URL/login/config; do not broaden the allowlist blindly          |
| Tagged device receives 403             | No interactive user login header was supplied                             | Use an allowlisted user-associated device                                   |
| Badge says Local through remote URL    | The request did not traverse the supported Serve authority path           | Stop and inspect proxy/Host behavior; another proxy is unsupported          |
| Browser reconnects forever             | Current bootstrap or WebSocket authorization fails                        | Inspect Serve/grant/config; PTYs remain on the host while the server lives  |
| `tailscale funnel status` names Pacium | Pacium may be public                                                      | Disable the exact Funnel route immediately and run the public denial checks |

## Evidence boundary

Repository tests deterministically prove:

- loopback-only server configuration;
- exact startup validation;
- local and proxy-shaped Host/Origin/login classification;
- missing, duplicate, tagged-device-only, unlisted, hostile, and invalid-token
  denial;
- authenticated remote-shaped HTTP/WebSocket and canary PTY behavior;
- browser connection labelling and stale-identity clearing.

They do not prove:

- the operator's real Tailscale installation, version, DNS, certificate, or
  node ownership;
- deployed grants or their interaction with other policy rules;
- Funnel/public/LAN firewall state;
- revocation propagation on a live tailnet;
- provider account policy or a release-ready deployment.

Keep those external checks explicit in release evidence.
