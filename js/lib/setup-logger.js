/* global Logger */

Logger.useDefaults()

// Available levels: [ DEBUG, INFO, WARN, ERROR ]
Logger.setLevel(Logger.DEBUG)

if (Logger.getLevel() === Logger.DEBUG) {
  const messages = ['To view debug logs, enable verbose logging in your browser']

  if (window.chrome) {
    messages.push('To do this in Chrome, select "Verbose" in the levels dropdown at the top of this console')
  }

  Logger.info(messages)
}
