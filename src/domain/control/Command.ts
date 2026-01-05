export interface CommandOutput {
    result(result: any): CommandOutput;
}

export interface Command {
    execute(): void
}
