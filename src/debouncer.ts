export class Debouncer {
    private static instance: Debouncer;
    private taskMap: Map<string, NodeJS.Timeout>;

    private constructor() {
        this.taskMap = new Map();
    }

    public static getInstance(): Debouncer {
        if (!Debouncer.instance) {
            Debouncer.instance = new Debouncer();
        }
        return Debouncer.instance;
    }

    public debounce(key: string, callback: () => void, delay: number): void {
        if (this.taskMap.has(key)) {
            clearTimeout(this.taskMap.get(key));
        }

        const taskId = setTimeout(() => {
            callback();
            this.taskMap.delete(key);
        }, delay);

        this.taskMap.set(key, taskId);
    }
}

// Usage
const debouncer = Debouncer.getInstance();
debouncer.debounce('log', () => {
    console.log("Function executed after debounce delay");
}, 300);
