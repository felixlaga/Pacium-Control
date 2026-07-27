import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  loadVerificationCatalog,
  MAX_VERIFICATION_CONFIG_BYTES,
  verificationPresetsForRepository,
} from "./verification-config.js";

describe("verification configuration", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it("is explicitly unconfigured when no path is supplied", () => {
    expect(loadVerificationCatalog(undefined)).toEqual({
      configured: false,
      repositories: [],
    });
  });

  it("canonicalizes a strict bounded catalog and matches exact roots", async () => {
    const fixture = await createFixture();
    const repositoryAlias = join(fixture.base, "repository-alias");
    const executableAlias = join(fixture.base, "executable-alias");
    await symlink(fixture.repository, repositoryAlias);
    await symlink(fixture.executable, executableAlias);
    await writeConfig(fixture.config, {
      version: 1,
      repositories: [
        {
          root: repositoryAlias,
          presets: [
            {
              id: "verify",
              label: "Project verification",
              description: "Run the local verification gate",
              executable: executableAlias,
              args: ["verify", "--reporter=dot"],
              timeoutMs: 30_000,
            },
          ],
        },
      ],
    });

    const catalog = loadVerificationCatalog(fixture.config);
    expect(catalog).toEqual({
      configured: true,
      repositories: [
        {
          root: await realpath(fixture.repository),
          presets: [
            {
              id: "verify",
              label: "Project verification",
              description: "Run the local verification gate",
              executable: await realpath(fixture.executable),
              args: ["verify", "--reporter=dot"],
              timeoutMs: 30_000,
            },
          ],
        },
      ],
    });
    expect(
      verificationPresetsForRepository(
        catalog,
        await realpath(fixture.repository),
      ),
    ).toHaveLength(1);
    expect(verificationPresetsForRepository(catalog, fixture.base)).toEqual([]);
  });

  it("requires an absolute regular non-symlink configuration file", async () => {
    const fixture = await createFixture();
    const configAlias = join(fixture.base, "config-alias.json");
    await writeConfig(fixture.config, { version: 1, repositories: [] });
    await symlink(fixture.config, configAlias);

    expect(() => loadVerificationCatalog("verification.json")).toThrow(
      "absolute path",
    );
    expect(() => loadVerificationCatalog(configAlias)).toThrow(
      "regular non-symlink file",
    );
  });

  it("rejects empty, excessive, and malformed configuration documents", async () => {
    const fixture = await createFixture();

    await writeFile(fixture.config, "");
    expect(() => loadVerificationCatalog(fixture.config)).toThrow(
      `between 1 and ${MAX_VERIFICATION_CONFIG_BYTES} bytes`,
    );

    await writeFile(
      fixture.config,
      Buffer.alloc(MAX_VERIFICATION_CONFIG_BYTES + 1, 0x20),
    );
    expect(() => loadVerificationCatalog(fixture.config)).toThrow(
      `between 1 and ${MAX_VERIFICATION_CONFIG_BYTES} bytes`,
    );

    await writeFile(fixture.config, "{not-json");
    expect(() => loadVerificationCatalog(fixture.config)).toThrow("valid JSON");
  });

  it("rejects unknown fields and invalid command definitions", async () => {
    const fixture = await createFixture();
    const validPreset = {
      id: "verify",
      label: "Verify",
      description: "Run checks",
      executable: fixture.executable,
      args: [],
      timeoutMs: 10_000,
    };

    await writeConfig(fixture.config, {
      version: 1,
      repositories: [
        {
          root: fixture.repository,
          presets: [{ ...validPreset, shell: true }],
        },
      ],
    });
    expect(() => loadVerificationCatalog(fixture.config)).toThrow();

    await writeConfig(fixture.config, {
      version: 1,
      repositories: [
        {
          root: fixture.repository,
          presets: [
            { ...validPreset, executable: "pnpm" },
            { ...validPreset, id: "Verify with spaces" },
          ],
        },
      ],
    });
    expect(() => loadVerificationCatalog(fixture.config)).toThrow();
  });

  it("rejects duplicate preset IDs and canonical repository roots", async () => {
    const fixture = await createFixture();
    const rootAlias = join(fixture.base, "root-alias");
    await symlink(fixture.repository, rootAlias);
    const preset = {
      id: "verify",
      label: "Verify",
      description: "Run checks",
      executable: fixture.executable,
      args: [],
      timeoutMs: 10_000,
    };

    await writeConfig(fixture.config, {
      version: 1,
      repositories: [
        {
          root: fixture.repository,
          presets: [preset, preset],
        },
      ],
    });
    expect(() => loadVerificationCatalog(fixture.config)).toThrow(
      "Preset IDs must be unique",
    );

    await writeConfig(fixture.config, {
      version: 1,
      repositories: [
        { root: fixture.repository, presets: [preset] },
        { root: rootAlias, presets: [preset] },
      ],
    });
    expect(() => loadVerificationCatalog(fixture.config)).toThrow(
      "duplicate canonical repository roots",
    );
  });

  it("keeps trusted configuration outside configured repositories", async () => {
    const fixture = await createFixture();
    const insideConfig = join(fixture.repository, "verification.json");
    await writeConfig(insideConfig, {
      version: 1,
      repositories: [
        {
          root: fixture.repository,
          presets: [
            {
              id: "verify",
              label: "Verify",
              description: "Run checks",
              executable: fixture.executable,
              args: [],
              timeoutMs: 10_000,
            },
          ],
        },
      ],
    });

    expect(() => loadVerificationCatalog(insideConfig)).toThrow(
      "outside every configured repository",
    );
  });

  async function createFixture(): Promise<{
    base: string;
    config: string;
    executable: string;
    repository: string;
  }> {
    const base = await mkdtemp(join(tmpdir(), "pacium-verification-config-"));
    temporaryDirectories.push(base);
    const repository = join(base, "repository");
    const executable = join(base, "verification-tool");
    await mkdir(repository);
    await writeFile(executable, "#!/bin/sh\nexit 0\n");
    await chmod(executable, 0o755);
    return {
      base,
      config: join(base, "verification.json"),
      executable,
      repository,
    };
  }
});

async function writeConfig(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value));
}
