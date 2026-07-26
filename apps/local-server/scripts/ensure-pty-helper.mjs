import { chmod, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

if (process.platform === "darwin") {
  const require = createRequire(import.meta.url);
  const packageRoot = dirname(dirname(require.resolve("node-pty")));
  const helper = join(
    packageRoot,
    "prebuilds",
    `darwin-${process.arch}`,
    "spawn-helper",
  );
  const mode = (await stat(helper)).mode;
  if ((mode & 0o100) === 0) {
    await chmod(helper, mode | 0o755);
    process.stdout.write("Restored node-pty spawn-helper executable mode.\n");
  }
}
