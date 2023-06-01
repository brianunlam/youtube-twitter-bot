import { stat, readFile } from 'fs/promises';

function incrementOneSecond(date: string) {
  const parsedDate = new Date(date);
  const timestamp = parsedDate.getTime();
  return new Date(timestamp + 1000).toISOString();
}

export async function getLastVideoPublishTime(source: string) {
  try {
    await stat(source);
    const result = JSON.parse(await readFile(source, 'utf-8'));
    const lastVideoPublishTime = result?.data?.items?.[0]?.snippet.publishedAt;
    return lastVideoPublishTime && incrementOneSecond(lastVideoPublishTime);
  } catch {
    /* return nothing */
  }
}
