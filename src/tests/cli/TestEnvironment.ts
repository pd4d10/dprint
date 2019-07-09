import { Environment } from "../../environment";

export class TestEnvironment implements Environment {
    private readonly logs: string[] = [];
    private readonly warns: string[] = [];
    private readonly errors: string[] = [];
    private readonly files = new Map<string, string>();

    log(text: string) {
        this.logs.push(text);
    }

    warn(text: string) {
        this.warns.push(text);
    }

    error(text: string) {
        this.errors.push(text);
    }

    getLogs() {
        return this.logs;
    }

    getWarns() {
        return this.warns;
    }

    getErrors() {
        return this.errors;
    }

    addFile(filePath: string, text: string) {
        this.files.set(filePath, text);
    }

    readFile(filePath: string) {
        const fileText = this.files.get(filePath);
        if (fileText == null)
            return Promise.reject(new Error("File not found."));

        return Promise.resolve(fileText);
    }

    writeFile(filePath: string, text: string) {
        this.files.set(filePath, text);
        return Promise.resolve();
    }

    resolvePath(path: string) {
        if (!path.startsWith("/"))
            path = "/" + path;
        return path;
    }

    glob(patterns: string[]) {
        return Promise.resolve(["/file1.ts", "/file2.ts"]);
    }
}
