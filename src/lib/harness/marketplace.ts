import { httpJson } from '../http';
import type { MarketplacePlugin } from '../../types';

const GITHUB_SEARCH = 'https://api.github.com/search/repositories';
const REEF_JSON = 'https://dsh.works/awesome-dsh-plugins/plugins.json';

export const FEATURED_PLUGINS: MarketplacePlugin[] = [
  {
    id: 'dshworks/awesome-dsh-plugins',
    name: 'awesome-dsh-plugins',
    fullName: 'dshworks/awesome-dsh-plugins',
    description: 'Curated registry of DeepSeek Harness plugins (topic:dsh-plugin).',
    stars: 0,
    url: 'https://github.com/dshworks/awesome-dsh-plugins',
    source: 'reef',
  },
  {
    id: 'ouyangyipeng/dsh-marketplace',
    name: 'dsh-marketplace',
    fullName: 'ouyangyipeng/dsh-marketplace',
    description: 'In-app Marketplace tab: search, inspect, install GitHub dsh-plugin repos.',
    stars: 0,
    url: 'https://github.com/ouyangyipeng/dsh-marketplace',
    source: 'github',
  },
  {
    id: 'AwesomeHou/dsh-plugin-marketplace',
    name: 'dsh-plugin-marketplace',
    fullName: 'AwesomeHou/dsh-plugin-marketplace',
    description: 'Live-sync GitHub dsh-plugin topic with one-click install tools.',
    stars: 0,
    url: 'https://github.com/AwesomeHou/dsh-plugin-marketplace',
    source: 'github',
  },
  {
    id: 'lijma/dsh-plugin-marketplace',
    name: 'dsh-plugin-marketplace',
    fullName: 'lijma/dsh-plugin-marketplace',
    description: 'DSH Index marketplace: browse, inspect, confirm-install community plugins.',
    stars: 0,
    url: 'https://github.com/lijma/dsh-plugin-marketplace',
    source: 'github',
  },
  {
    id: 'vlln/whale-girl',
    name: 'whale-girl',
    fullName: 'vlln/whale-girl',
    description: 'Desktop-pet companion for the DSH web GUI.',
    stars: 182,
    url: 'https://github.com/vlln/whale-girl',
    source: 'github',
    verifiedAgainst: '0.1.0-rc.6',
  },
];

interface GhRepo {
  full_name: string;
  name: string;
  description?: string | null;
  html_url: string;
  stargazers_count: number;
  language?: string | null;
  updated_at?: string;
}

function mapRepo(repo: GhRepo): MarketplacePlugin {
  return {
    id: repo.full_name,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description || 'DeepSeek Harness community plugin',
    stars: repo.stargazers_count,
    url: repo.html_url,
    language: repo.language ?? undefined,
    updatedAt: repo.updated_at,
    source: 'github',
  };
}

export async function searchGithubPlugins(query = '', page = 1): Promise<MarketplacePlugin[]> {
  const q = ['topic:dsh-plugin', query.trim()].filter(Boolean).join(' ');
  const url = `${GITHUB_SEARCH}?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=30&page=${page}`;
  const res = await httpJson(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'dsh-agent-android' },
  });
  if (res.status >= 400) {
    throw new Error(`GitHub ${res.status}`);
  }
  const payload = res.data as { items?: GhRepo[] };
  return (payload.items ?? []).map(mapRepo);
}

export async function searchReefPlugins(query = ''): Promise<MarketplacePlugin[]> {
  const res = await httpJson(REEF_JSON, { timeout: 20000 });
  if (res.status >= 400 || !Array.isArray(res.data)) {
    throw new Error('reef catalog unavailable');
  }
  const q = query.trim().toLowerCase();
  const items = (res.data as Array<Record<string, unknown>>)
    .map((row) => {
      const fullName = String(row.repo ?? row.fullName ?? row.id ?? '');
      const name = String(row.name ?? fullName.split('/')[1] ?? fullName);
      return {
        id: fullName || name,
        name,
        fullName: fullName || name,
        description: String(row.description ?? row.summary ?? ''),
        stars: Number(row.stars ?? row.stargazers ?? 0),
        url: String(row.url ?? (fullName ? `https://github.com/${fullName}` : '')),
        npm: typeof row.npm === 'string' ? row.npm : undefined,
        verifiedAgainst: typeof row.verifiedAgainst === 'string' ? row.verifiedAgainst : undefined,
        source: 'reef' as const,
      } satisfies MarketplacePlugin;
    })
    .filter((p) => p.id);
  if (!q) return items.slice(0, 80);
  return items
    .filter((p) => `${p.name} ${p.fullName} ${p.description}`.toLowerCase().includes(q))
    .slice(0, 80);
}

export async function loadMarketplace(query = ''): Promise<{ plugins: MarketplacePlugin[]; source: string }> {
  try {
    const plugins = await searchGithubPlugins(query);
    if (plugins.length) return { plugins, source: 'GitHub topic:dsh-plugin' };
  } catch {
    /* fall through */
  }
  try {
    const plugins = await searchReefPlugins(query);
    if (plugins.length) return { plugins, source: 'dsh.works reef catalog' };
  } catch {
    /* fall through */
  }
  const q = query.trim().toLowerCase();
  const plugins = FEATURED_PLUGINS.filter((p) => !q || `${p.name} ${p.description}`.toLowerCase().includes(q));
  return { plugins, source: 'featured fallback' };
}

export function installSpec(plugin: MarketplacePlugin): string {
  if (plugin.npm) return plugin.npm;
  return `github:${plugin.fullName}`;
}
