/**
 * Worktree Path Utilities
 *
 * Resolves git worktree roots for cwd/git element rendering.
 */
import { execSync } from 'child_process';
import { resolve } from 'path';
/**
 * LRU cache for worktree root lookups to avoid repeated git subprocess calls.
 * Bounded to MAX_WORKTREE_CACHE_SIZE entries to prevent memory growth when
 * alternating between many different cwds (cache thrashing).
 */
const MAX_WORKTREE_CACHE_SIZE = 8;
const worktreeCacheMap = new Map();
/**
 * Get the git worktree root for the current or specified directory.
 * Returns null if not in a git repository.
 */
export function getWorktreeRoot(cwd) {
    const effectiveCwd = cwd || process.cwd();
    // Return cached value if present (LRU: move to end on access)
    if (worktreeCacheMap.has(effectiveCwd)) {
        const root = worktreeCacheMap.get(effectiveCwd);
        worktreeCacheMap.delete(effectiveCwd);
        worktreeCacheMap.set(effectiveCwd, root);
        return root || null;
    }
    try {
        const root = execSync('git rev-parse --show-toplevel', {
            cwd: effectiveCwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 5000,
        }).trim();
        // Evict oldest entry when at capacity
        if (worktreeCacheMap.size >= MAX_WORKTREE_CACHE_SIZE) {
            const oldest = worktreeCacheMap.keys().next().value;
            if (oldest !== undefined) {
                worktreeCacheMap.delete(oldest);
            }
        }
        worktreeCacheMap.set(effectiveCwd, root);
        return root;
    }
    catch {
        // Not in a git repository — do NOT cache so we re-detect if it becomes one
        return null;
    }
}
/**
 * Resolve a directory path to its git worktree root.
 *
 * Falls back to the process CWD worktree root, then process.cwd() itself.
 *
 * @param directory - Any directory inside a git worktree (optional)
 * @returns The worktree root (never a subdirectory)
 */
export function resolveToWorktreeRoot(directory) {
    if (directory) {
        const resolved = resolve(directory);
        const root = getWorktreeRoot(resolved);
        if (root)
            return root;
        console.error('[worktree] non-git directory provided, falling back to process root', {
            directory: resolved,
        });
    }
    return getWorktreeRoot(process.cwd()) || process.cwd();
}
//# sourceMappingURL=worktree-paths.js.map