import * as cron from 'node-cron';

export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  handler: () => Promise<void>;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  enabled: boolean;
}

export class Scheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private cronTasks: Map<string, cron.ScheduledTask> = new Map();
  private running = false;

  addTask(
    id: string,
    name: string,
    cronExpression: string,
    handler: () => Promise<void>
  ): void {
    if (cronExpression === 'on-demand') {
      // Store as a manually-triggered task only
      const task: ScheduledTask = {
        id,
        name,
        cronExpression,
        handler,
        runCount: 0,
        enabled: true,
      };
      this.tasks.set(id, task);
      return;
    }

    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression for task "${name}": ${cronExpression}`);
    }

    const task: ScheduledTask = {
      id,
      name,
      cronExpression,
      handler,
      runCount: 0,
      enabled: true,
    };

    this.tasks.set(id, task);

    if (this.running) {
      this.scheduleCronTask(task);
    }
  }

  private scheduleCronTask(task: ScheduledTask): void {
    if (task.cronExpression === 'on-demand') return;

    const cronTask = cron.schedule(task.cronExpression, async () => {
      const storedTask = this.tasks.get(task.id);
      if (!storedTask || !storedTask.enabled) return;

      console.log(`[Scheduler] Running task: ${task.name}`);
      storedTask.lastRun = new Date();
      storedTask.runCount += 1;

      try {
        await task.handler();
      } catch (err) {
        console.error(`[Scheduler] Task "${task.name}" failed:`, err);
      }
    });

    this.cronTasks.set(task.id, cronTask);
  }

  removeTask(id: string): boolean {
    const cronTask = this.cronTasks.get(id);
    if (cronTask) {
      cronTask.stop();
      this.cronTasks.delete(id);
    }
    return this.tasks.delete(id);
  }

  async runNow(id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task "${id}" not found`);
    }

    console.log(`[Scheduler] Manually running task: ${task.name}`);
    task.lastRun = new Date();
    task.runCount += 1;

    await task.handler();
  }

  getStatus(): Array<{
    id: string;
    name: string;
    cronExpression: string;
    lastRun: Date | undefined;
    runCount: number;
    enabled: boolean;
  }> {
    return Array.from(this.tasks.values()).map((t) => ({
      id: t.id,
      name: t.name,
      cronExpression: t.cronExpression,
      lastRun: t.lastRun,
      runCount: t.runCount,
      enabled: t.enabled,
    }));
  }

  enableTask(id: string): void {
    const task = this.tasks.get(id);
    if (task) task.enabled = true;
  }

  disableTask(id: string): void {
    const task = this.tasks.get(id);
    if (task) task.enabled = false;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    for (const task of this.tasks.values()) {
      if (task.cronExpression !== 'on-demand') {
        this.scheduleCronTask(task);
      }
    }

    console.log(`[Scheduler] Started with ${this.tasks.size} task(s)`);
  }

  stop(): void {
    if (!this.running) return;

    for (const [id, cronTask] of this.cronTasks.entries()) {
      cronTask.stop();
      this.cronTasks.delete(id);
    }

    this.running = false;
    console.log('[Scheduler] Stopped all tasks');
  }

  isRunning(): boolean {
    return this.running;
  }

  getTaskCount(): number {
    return this.tasks.size;
  }
}
