// leer config
// hacer query y encolar
import config from './config';
import { checkAndHandleVideos } from './youtube/checkAndHandleVideos';

const { queries } = config;

async function main() {
  for (const query of queries) {
    await checkAndHandleVideos(query, query.name);
  }
}

main();
