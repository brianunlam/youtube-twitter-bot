import 'dotenv/config';

import nodeConfig from 'config';

interface Config {
  youtubeApiKey: string;
  queries: any[];
}

const config: Config = {
  youtubeApiKey: nodeConfig.get<string>('youtubeApiKey'),
  queries: nodeConfig.get<any[]>('queries'),
  // youtubeQuery: nodeConfig.get<any>('youtubeQuery'),
  // videosQueue: '',
  // filterByLength: {
  //   min: nodeConfig.get<number>('filterByLength.min'),
  //   max: nodeConfig.get<number>('filterByLength.max'),
  // },
};

// it is used for debugging and to keep track of last published videos
export const TEMP_LAST_YOUTUBE_REQUEST_PATH = './temp';

export default config;
