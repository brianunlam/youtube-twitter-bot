export function filterByLength(args: any) {
  return function (item: any) {
    return item.duration > args.min && item.duration < args.max;
  };
}
