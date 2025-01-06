

export abstract class CppProvider {
    
    abstract extensionId: string;
    abstract isCpptoolsInstalled(): boolean;
    abstract validateConfiguration(): Promise<boolean>;
}

