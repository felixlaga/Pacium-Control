export interface FakePtyExitEvent {
  exitCode: number;
  signal: number;
}

export class FakePty {
  public readonly pid: number;
  public readonly writes: string[] = [];
  public readonly resizes: Array<{ cols: number; rows: number }> = [];
  public readonly signals: Array<string | undefined> = [];
  private readonly dataListeners = new Set<(data: string) => void>();
  private readonly exitListeners = new Set<(event: FakePtyExitEvent) => void>();

  public constructor(pid = 41_000) {
    this.pid = pid;
  }

  public onData(listener: (data: string) => void): { dispose(): void } {
    this.dataListeners.add(listener);
    return {
      dispose: () => {
        this.dataListeners.delete(listener);
      },
    };
  }

  public onExit(listener: (event: FakePtyExitEvent) => void): {
    dispose(): void;
  } {
    this.exitListeners.add(listener);
    return {
      dispose: () => {
        this.exitListeners.delete(listener);
      },
    };
  }

  public write(data: string): void {
    this.writes.push(data);
  }

  public resize(cols: number, rows: number): void {
    this.resizes.push({ cols, rows });
  }

  public kill(signal?: string): void {
    this.signals.push(signal);
  }

  public emitData(data: string): void {
    for (const listener of this.dataListeners) {
      listener(data);
    }
  }

  public emitExit(exitCode = 0, signal = 0): void {
    for (const listener of this.exitListeners) {
      listener({ exitCode, signal });
    }
  }
}

export class FakePtyFactory {
  public readonly processes: FakePty[] = [];
  public readonly createCalls: Array<{
    executable: string;
    args: readonly string[];
    cwd: string;
    cols: number;
    rows: number;
    environment?: Readonly<Record<string, string>>;
  }> = [];

  public create(options: {
    executable: string;
    args: readonly string[];
    cwd: string;
    cols: number;
    rows: number;
    environment?: Readonly<Record<string, string>>;
  }): FakePty {
    this.createCalls.push(options);
    const process = new FakePty(41_000 + this.processes.length);
    this.processes.push(process);
    return process;
  }
}
