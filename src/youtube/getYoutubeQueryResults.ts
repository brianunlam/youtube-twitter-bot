// eslint-disable-next-line camelcase
import { google, youtube_v3 } from 'googleapis';
import { writeFile } from 'fs/promises';
import config from '../config';
import { convertDurationToSeconds } from '../utils/convertDurationToSeconds';

const { youtubeApiKey } = config;

export async function getYoutubeQueryResults(
  resultsPath: string,
  options: {
    youtubeApiKey: string;
    // eslint-disable-next-line camelcase
    youtubeQuery: youtube_v3.Params$Resource$Search$List;
  }
) {
  const yt = google.youtube({
    version: 'v3',
    auth: options.youtubeApiKey || youtubeApiKey,
  });
  const queryParams = {
    ...options.youtubeQuery,
    part: ['id', 'snippet'],
  };
  const result = (await yt.search.list(queryParams)) as any;
  const allItems = result?.data?.items || [];
  const lastItemDate = allItems[0]?.snippet.publishedAt;
  const destPath = lastItemDate
    ? `${resultsPath}.json`
    : `${resultsPath}_empty.json`;
  await writeFile(destPath, JSON.stringify(result, null, 2), 'utf8');
  if (lastItemDate) {
    const onlyVideos = allItems.filter(
      (item: any) => item.id.kind === 'youtube#video'
    );
    const itemIds: string[] = onlyVideos.map((item: any) => item.id.videoId);
    if (itemIds.length > 0) {
      const detailsResponse = await yt.videos.list({
        id: itemIds,
        part: ['contentDetails'],
      });
      const details = detailsResponse.data.items?.reduce(
        (acc: any, item: any) => {
          if (typeof item.id === 'string') {
            acc[item.id] = item.contentDetails;
          }
          return acc;
        },
        {}
      );
      const queryResult = onlyVideos.reduce((acc: any, item: any) => {
        acc[item.id.videoId] = {
          id: item.id.videoId,
          snippet: item.snippet,
          contentDetails: details[item.id.videoId],
          duration: convertDurationToSeconds(details[item.id.videoId].duration),
        };
        return acc;
      }, {});
      await writeFile(
        `${resultsPath}_detailed.json`,
        JSON.stringify(detailsResponse, null, 2),
        'utf8'
      );
      return queryResult;
    }
  }
  return {};
}
