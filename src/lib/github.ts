import { useSettingsStore } from '@/src/store/settings';

const GITHUB_API_URL = 'https://api.github.com';

async function fetchGitHub(endpoint: string, options: RequestInit = {}) {
  const token = useSettingsStore.getState().githubToken;
  if (!token) throw new Error('No GitHub token provided');

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/vnd.github.v3+json');
  // Avoid caching for logs/workflows to ensure real-time polling
  if (options.method === 'GET') {
    headers.set('Cache-Control', 'no-cache');
  }

  const response = await fetch(`${GITHUB_API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = response.statusText;
    try {
      const errorData = await response.json();
      errorMsg = errorData.message || response.statusText;
    } catch (e) {
      // Ignore
    }
    throw new Error(`GitHub API error: ${response.status} - ${errorMsg}`);
  }

  // Handle No Content
  if (response.status === 204) {
    return null;
  }

  // Handle redirect for artefacts (blob)
  if (response.redirected) {
    return response.blob(); 
  }

  return response.json();
}

export const githubApi = {
  // Repositories
  getRepos: async () => {
    // We should fetch both user and org repos
    const userRepos = await fetchGitHub('/user/repos?sort=updated&per_page=100');
    return userRepos;
  },
  getRepo: async (owner: string, repo: string) => fetchGitHub(`/repos/${owner}/${repo}`),
  createRepo: async (data: { name: string; description?: string; private?: boolean }) =>
    fetchGitHub('/user/repos', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteRepo: async (owner: string, repo: string) =>
    fetchGitHub(`/repos/${owner}/${repo}`, { method: 'DELETE' }),

  // Workflows & Runs
  getRuns: async (owner: string, repo: string, perPage = 20) =>
    fetchGitHub(`/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`),
  getRunJobs: async (owner: string, repo: string, runId: number) =>
    fetchGitHub(`/repos/${owner}/${repo}/actions/runs/${runId}/jobs`),
  getJobLogs: async (owner: string, repo: string, jobId: number) => {
    const token = useSettingsStore.getState().githubToken;
    const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!response.ok) throw new Error('Failed to fetch logs');
    return response.text();
  },
  triggerWorkflow: async (owner: string, repo: string, workflowId: string | number, ref: string) =>
    fetchGitHub(`/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ ref }),
    }),

  // Files
  getFile: async (owner: string, repo: string, path: string, ref?: string) => {
    const query = ref ? `?ref=${ref}` : '';
    const res = await fetchGitHub(`/repos/${owner}/${repo}/contents/${path}${query}`);
    return res;
  },
  updateFile: async (
    owner: string,
    repo: string,
    path: string,
    message: string,
    content: string, // Base64 encoded
    sha: string,
    branch: string
  ) =>
    fetchGitHub(`/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({ message, content, sha, branch }),
    }),

  // Artifacts
  getArtifacts: async (owner: string, repo: string, runId?: number) => {
    let endpoint = `/repos/${owner}/${repo}/actions/artifacts`;
    if (runId) endpoint = `/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`;
    return fetchGitHub(endpoint);
  },
  downloadArtifact: async (owner: string, repo: string, artifactId: number) => {
     // Direct download typically requires following redirects
     const token = useSettingsStore.getState().githubToken;
     const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`, {
       redirect: 'follow',
       headers: {
         Authorization: `Bearer ${token}`
       }
     });
     if (!response.ok) throw new Error('Failed to download artifact');
     return response.blob();
  }
};
