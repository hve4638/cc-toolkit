import { compactReset, ensureCacheDir, resolveProjectRoot } from '../lib/state-file.mjs';

export default async function postcompact(payload) {
  const { session_id, agent_id } = payload;
  if (!session_id) return null;

  const projectRoot = resolveProjectRoot(payload);
  ensureCacheDir(projectRoot);
  compactReset({ projectRoot, sessionId: session_id, agentId: agent_id });
  return null;
}
