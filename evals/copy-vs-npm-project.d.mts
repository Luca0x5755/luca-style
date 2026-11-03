export const kinds: string[];
export const taskFile: (kind: string) => string;
export function buildUpgradePackage(temporary: string, destination: string): Promise<string>;
export function prepareCopyVsNpmProject(kind: 'crud-copy' | 'update-npm' | 'update-copy', workspace: string, temporary: string, options: { install: boolean }): Promise<{ tarballs: string[] }>;
export function listFiles(workspace: string): Promise<string[]>;
export function pristineLibraryFiles(workspace: string): Promise<string[]>;
