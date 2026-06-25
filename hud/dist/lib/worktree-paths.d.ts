/**
 * Worktree Path Utilities
 *
 * Resolves git worktree roots for cwd/git element rendering.
 */
/**
 * Get the git worktree root for the current or specified directory.
 * Returns null if not in a git repository.
 */
export declare function getWorktreeRoot(cwd?: string): string | null;
/**
 * Resolve a directory path to its git worktree root.
 *
 * Falls back to the process CWD worktree root, then process.cwd() itself.
 *
 * @param directory - Any directory inside a git worktree (optional)
 * @returns The worktree root (never a subdirectory)
 */
export declare function resolveToWorktreeRoot(directory?: string): string;
