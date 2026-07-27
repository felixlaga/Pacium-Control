# Local identity and transport security

## Initial identity

The initial product has one local operator: the operating-system user who launches Pacium.

There are no application users, memberships, roles, or repository authorization rules.

## Browser-to-local-server boundary

The server still protects terminal control from unrelated local web pages:

- bind to `127.0.0.1`;
- validate `Origin`;
- require a local access token;
- use secure token delivery during application launch;
- bound requests and WebSocket frames;
- avoid reusable tokens in durable URLs and logs;
- reject unknown protocol versions and message types.

## Local process authority

PTY processes run as the invoking user. Pacium does not elevate privileges, request root, or claim to sandbox that user’s shell.

## Paths

- Working directories must exist and be directories.
- Repository roots are canonicalized.
- Symlink and traversal behavior is tested.
- Reusable presets store typed command/arguments rather than shell-parsed strings where practical.

## Optional Tailscale access

ADR-0016 permits one remote shape:

- Tailscale Serve proxies HTTPS and WebSockets to loopback Pacium.
- Tailscale grants restrict network reachability.
- Verified Serve user headers identify the requesting operator.
- An explicit login allowlist denies other tailnet users.
- The ephemeral Pacium token still protects the application transport.

This remains a single-operator application on the same host as its PTYs. Shared input, multiple application users, another proxy, public ingress, or cross-host control requires a new ADR.
