import 'dotenv/config';

import nodeConfig from 'config';

interface Config {
  youtubeApiKey: string;
  videosQueue: string;
  youtubeQuery: any;
  filterByLength: {
    min: number;
    max: number;
  };
}

const config: Config = {
  youtubeApiKey: nodeConfig.get<string>('youtubeApiKey'),
  youtubeQuery: nodeConfig.get<any>('youtubeQuery'),
  videosQueue: '',
  filterByLength: {
    min: nodeConfig.get<number>('filterByLength.min'),
    max: nodeConfig.get<number>('filterByLength.max'),
  },
};

export default config;
