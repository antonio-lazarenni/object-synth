const APP_VERSION = __APP_VERSION__
const APP_COMMIT = __APP_COMMIT__
const APP_BUILD_TIME = __APP_BUILD_TIME__

const formatBuildTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

export const appVersionInfo = {
  version: APP_VERSION,
  commit: APP_COMMIT,
  buildTimeIso: APP_BUILD_TIME,
  buildTimeLabel: formatBuildTime(APP_BUILD_TIME),
}
