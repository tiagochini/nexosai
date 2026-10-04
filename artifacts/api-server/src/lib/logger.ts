import pino from "pino";
import { sanitizeLogValue } from "./log-security.js";

const isProduction = process.env.NODE_ENV === "production";

function secureSerializers(serializers: pino.LoggerOptions["serializers"]) {
  if (!serializers) return undefined;
  return Object.fromEntries(Object.entries(serializers).map(([key, serializer]) => [key, (value: unknown) => {
    try {
      return (sanitizeLogValue({ [key]: serializer(value) }) as Record<string, unknown>)[key];
    } catch { return "[UNSERIALIZABLE]"; }
  }]));
}

export function createSafeLogger(options: pino.LoggerOptions = {}, destination?: pino.DestinationStream) {
  const secureOptions: pino.LoggerOptions = {
    ...options,
    serializers: secureSerializers(options.serializers),
    hooks: {
      logMethod(args, method) {
        method.apply(this, args.map((arg) => sanitizeLogValue(arg)) as typeof args);
      },
    },
    formatters: {
      bindings: (bindings) => sanitizeLogValue(bindings) as Record<string, unknown>,
      log: (object) => sanitizeLogValue(object) as Record<string, unknown>,
    },
  };
  function protectBindings(instance: pino.Logger): pino.Logger {
    const originalChild = instance.child;
    const originalSetBindings = instance.setBindings;
    // Pino resets bindings formatters on child creation; enforce them explicitly.
    instance.child = function (this: pino.Logger, bindings, childOptions) {
      const child = originalChild.call(this, sanitizeLogValue(bindings) as pino.Bindings, {
        ...childOptions,
        serializers: secureSerializers(childOptions?.serializers) ?? {},
        formatters: {
          ...childOptions?.formatters,
          bindings: (value) => sanitizeLogValue(value) as Record<string, unknown>,
          log: (value) => sanitizeLogValue(value) as Record<string, unknown>,
        },
      });
      return protectBindings(child);
    } as pino.Logger["child"];
    instance.setBindings = function (bindings) {
      originalSetBindings.call(this, sanitizeLogValue(bindings) as pino.Bindings);
    };
    return instance;
  }
  return protectBindings(destination ? pino(secureOptions, destination) : pino(secureOptions));
}

export const logger = createSafeLogger({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
