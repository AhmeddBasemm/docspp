export function serve(dir: string, port: number): Promise<{ url: string; close: () => Promise<void> }>
