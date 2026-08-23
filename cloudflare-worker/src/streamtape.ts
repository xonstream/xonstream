import type { Bindings } from './types';

const BASE_URL = 'https://api.streamtape.com';

export function getEmbedUrl(videoId: string): string {
  return `https://streamtape.com/e/${videoId}`;
}

export function getDownloadUrl(videoId: string): string {
  return `https://streamtape.com/v/${videoId}`;
}

export function getDefaultThumbnailUrl(videoId: string): string {
  return `https://thumb.tapecontent.net/thumb/${videoId}/thumb.jpg`;
}

export async function fetchStreamtapeApi(endpoint: string, params: Record<string, string>, env: Bindings): Promise<any> {
  const login = env.STREAMTAPE_LOGIN || '';
  const key = env.STREAMTAPE_KEY || '';

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('login', login);
  url.searchParams.set('key', key);

  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'XonStream-Cloudflare-Worker/3.0'
    }
  });

  if (!res.ok) {
    throw new Error(`Streamtape API HTTP ${res.status}`);
  }

  const data: any = await res.json();
  if (data.status !== 200) {
    throw new Error(data.msg || `Streamtape API error status ${data.status}`);
  }

  return data.result;
}

export async function getStreamtapeFileInfo(fileId: string, env: Bindings): Promise<any> {
  try {
    return await fetchStreamtapeApi('/file/info', { file: fileId }, env);
  } catch (err) {
    return null;
  }
}

export async function getAllStreamtapeFiles(folderId = '', env: Bindings): Promise<any[]> {
  try {
    const allFiles: any[] = [];
    const visitedFolders = new Set<string>();
    const folderQueue: string[] = [folderId];

    while (folderQueue.length > 0) {
      const currentFolder = folderQueue.shift() || '';
      if (visitedFolders.has(currentFolder)) continue;
      visitedFolders.add(currentFolder);

      try {
        const params: Record<string, string> = {};
        if (currentFolder) params.folder = currentFolder;
        const result = await fetchStreamtapeApi('/file/listfolder', params, env);

        if (result && Array.isArray(result.files)) {
          for (const file of result.files) {
            const vid = file.linkid || file.id;
            if (vid) {
              allFiles.push({
                linkid: vid,
                id: vid,
                name: file.name || 'Untitled Video',
                size: file.size || 0,
                created_at: file.created_at
              });
            }
          }
        }

        if (result && Array.isArray(result.folders)) {
          for (const folder of result.folders) {
            if (folder.id && !visitedFolders.has(folder.id)) {
              folderQueue.push(folder.id);
            }
          }
        }
      } catch (err) {
        if (currentFolder === '') throw err;
      }
    }

    return allFiles;
  } catch (err) {
    return [];
  }
}

export async function getBatchThumbnails(videoIds: string[], env: Bindings): Promise<Record<string, string>> {
  const thumbMap: Record<string, string> = {};
  if (!videoIds || videoIds.length === 0) return thumbMap;

  // Process in chunks of 50
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    try {
      const fileInfo = await fetchStreamtapeApi('/file/info', { file: chunk.join(',') }, env);
      if (fileInfo && typeof fileInfo === 'object') {
        for (const id of chunk) {
          const item = fileInfo[id];
          if (item?.thumb) {
            thumbMap[id] = item.thumb;
          } else {
            thumbMap[id] = `https://thumb.tapecontent.net/thumb/${id}/thumb.jpg`;
          }
        }
      }
    } catch {
      for (const id of chunk) {
        if (!thumbMap[id]) {
          thumbMap[id] = `https://thumb.tapecontent.net/thumb/${id}/thumb.jpg`;
        }
      }
    }
  }

  return thumbMap;
}
