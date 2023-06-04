import { getLastVideoPublishTime } from './getLastVideoPublishTime';
import { getYoutubeQueryResults } from './getYoutubeQueryResults';
import { TEMP_LAST_YOUTUBE_REQUEST_PATH } from '../config';
import * as handlers from '../handlers';
import * as filters from '../filters';

export async function checkAndHandleVideos(
  options: {
    youtubeQuery: any;
    checkInterval: number;
    handler: handlers.Handlers;
    filters: {
      id: filters.Filters;
      args: any;
    }[];
  },
  name: string
) {
  const lastVideoPublishTime = await getLastVideoPublishTime(
    `${TEMP_LAST_YOUTUBE_REQUEST_PATH}/${name}`
  );
  const result = await getYoutubeQueryResults(
    `${TEMP_LAST_YOUTUBE_REQUEST_PATH}/${name}`,
    {
      youtubeQuery: {
        ...options.youtubeQuery,
        publishedAfter: lastVideoPublishTime,
        order: 'date',
      },
      youtubeApiKey: '',
    }
  );
  let items: any[] = Object.values(result);
  console.log({ options, xxx: (options.filters || []).length });
  if ((options.filters || []).length > 0) {
    console.log('************');
    items = options.filters.reduce((itemsAcc, { id, args }) => {
      return itemsAcc.filter(filters[id](args));
    }, items);
  }
  const handler = handlers[options.handler];
  // const videos = options.filter;
  for (const video of items) {
    await handler(name, video);
  }
  setTimeout(
    () => checkAndHandleVideos(options, name),
    options.checkInterval * 1000 * 60
  );
}
