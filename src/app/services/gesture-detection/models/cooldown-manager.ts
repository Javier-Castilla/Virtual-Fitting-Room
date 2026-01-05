export class CooldownManager {
    private lastTriggerTime = 0;

    constructor(private cooldownMs: number) {}

    canTrigger(): boolean {
        return Date.now() - this.lastTriggerTime > this.cooldownMs;
    }

    trigger(): void {
        this.lastTriggerTime = Date.now();
    }

    reset(): void {
        this.lastTriggerTime = 0;
    }
}
