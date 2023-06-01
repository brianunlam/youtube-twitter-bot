// generated using chatgpt

export function convertDurationToSeconds(duration: string): number {
  const regex = /(\d+)([DHMS])/g;
  let seconds = 0;
  let match = regex.exec(duration);

  while (match !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'D':
        seconds += value * 24 * 60 * 60;
        break;
      case 'H':
        seconds += value * 60 * 60;
        break;
      case 'M':
        seconds += value * 60;
        break;
      case 'S':
        seconds += value;
        break;
      default:
        throw new Error(`Unrecognized unit: ${unit}`);
    }

    match = regex.exec(duration);
  }

  return seconds;
}
