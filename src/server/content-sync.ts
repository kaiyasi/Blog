type SyncTarget = 'github' | 'gitlab';

type RemoteFile = {
  content?: string;
  sha?: string;
};

export class ContentSyncError extends Error {
  constructor(public code: 'content_sync_not_configured' | 'content_sync_failed') {
    super(code);
  }
}

const value = (name: string, fallback = '') => process.env[name]?.trim() || fallback;

const sameContent = (remote: RemoteFile | null, contents: string) => {
  if (!remote?.content) return false;
  return Buffer.from(remote.content.replace(/\s/g, ''), 'base64').toString('utf8') === contents;
};

async function responseJson(response: Response) {
  try {
    return await response.json() as RemoteFile;
  } catch {
    return {};
  }
}

async function syncGitHub(path: string, contents: string, message: string) {
  const token = value('CONTENT_GITHUB_TOKEN');
  if (!token) return false;
  const owner = value('CONTENT_GITHUB_OWNER', 'kaiyasi');
  const repository = value('CONTENT_GITHUB_REPO', 'Blog');
  const branch = value('CONTENT_GITHUB_BRANCH', 'main');
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  const headers = new Headers({
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'kaiyasi-blog-content-sync',
    'X-GitHub-Api-Version': '2022-11-28',
  });
  const currentResponse = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers });
  if (!currentResponse.ok && currentResponse.status !== 404) {
    throw new Error(`GitHub read returned HTTP ${currentResponse.status}`);
  }
  const current = currentResponse.ok ? await responseJson(currentResponse) : null;
  if (sameContent(current, contents)) return true;

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: new Headers({ ...Object.fromEntries(headers), 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      message,
      content: Buffer.from(contents, 'utf8').toString('base64'),
      branch,
      ...(current?.sha ? { sha: current.sha } : {}),
    }),
  });
  if (!response.ok) throw new Error(`GitHub write returned HTTP ${response.status}`);
  return true;
}

async function syncGitLab(path: string, contents: string, message: string) {
  const token = value('CONTENT_GITLAB_TOKEN');
  if (!token) return false;
  const baseUrl = value('CONTENT_GITLAB_BASE_URL', 'https://gitlab.serelix.xyz').replace(/\/$/, '');
  const project = value('CONTENT_GITLAB_PROJECT', 'Kaiyasi/given');
  const branch = value('CONTENT_GITLAB_BRANCH', 'main');
  const endpoint = `${baseUrl}/api/v4/projects/${encodeURIComponent(project)}/repository/files/${encodeURIComponent(path)}`;
  const headers = new Headers({ 'PRIVATE-TOKEN': token });
  const currentResponse = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers });
  if (!currentResponse.ok && currentResponse.status !== 404) {
    throw new Error(`GitLab read returned HTTP ${currentResponse.status}`);
  }
  const current = currentResponse.ok ? await responseJson(currentResponse) : null;
  if (sameContent(current, contents)) return true;

  const response = await fetch(endpoint, {
    method: current ? 'PUT' : 'POST',
    headers: new Headers({ ...Object.fromEntries(headers), 'Content-Type': 'application/json' }),
    body: JSON.stringify({ branch, content: contents, commit_message: message }),
  });
  if (!response.ok) throw new Error(`GitLab write returned HTTP ${response.status}`);
  return true;
}

export async function syncContentFile(path: string, contents: string, message: string) {
  const configured = {
    github: Boolean(value('CONTENT_GITHUB_TOKEN')),
    gitlab: Boolean(value('CONTENT_GITLAB_TOKEN')),
  } satisfies Record<SyncTarget, boolean>;
  if (!configured.github && !configured.gitlab) {
    if (value('CONTENT_SYNC_REQUIRED').toLowerCase() === 'true') {
      throw new ContentSyncError('content_sync_not_configured');
    }
    return false;
  }
  if (value('CONTENT_SYNC_REQUIRED').toLowerCase() === 'true' && (!configured.github || !configured.gitlab)) {
    throw new ContentSyncError('content_sync_not_configured');
  }

  const results = await Promise.allSettled([
    configured.github ? syncGitHub(path, contents, message) : Promise.resolve(false),
    configured.gitlab ? syncGitLab(path, contents, message) : Promise.resolve(false),
  ]);
  const targets: SyncTarget[] = ['github', 'gitlab'];
  const failures = results.flatMap((result, index) => result.status === 'rejected'
    ? [`${targets[index]}: ${result.reason instanceof Error ? result.reason.message : 'unknown error'}`]
    : []);
  if (failures.length) {
    console.error(`Content sync failed for ${path}: ${failures.join('; ')}`);
    throw new ContentSyncError('content_sync_failed');
  }
  return true;
}
