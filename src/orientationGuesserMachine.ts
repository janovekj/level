import { assign, createMachine, Sender } from "xstate";
import { v4 as uuidv4 } from "uuid";

const isProd = import.meta.env.PROD;
const isDev = import.meta.env.DEV;

export interface Orientation {
  x: number;
  y: number;
}

export interface Guess extends Orientation {
  id: string;
  timestamp: number;
}

const isOrientation = (
  maybeOrientation: unknown
): maybeOrientation is Orientation => {
  const { x, y } = (maybeOrientation as Orientation) ?? {};
  return typeof x === "number" && typeof y === "number";
};

function assertOrientation(
  maybeOrientation: unknown
): asserts maybeOrientation is Orientation {
  if (!isOrientation(maybeOrientation)) {
    throw new Error(
      `Not a valid orientation: ${JSON.stringify(maybeOrientation)}`
    );
  }
}

function assertHasGuesses(
  maybeWithGuesses: unknown
): asserts maybeWithGuesses is { guesses: Guess[] } {
  if (
    !(
      maybeWithGuesses &&
      typeof maybeWithGuesses === "object" &&
      "guesses" in maybeWithGuesses &&
      Array.isArray((maybeWithGuesses as { guesses: unknown }).guesses)
    )
  ) {
    throw new Error(
      `Object doesn't have guesses: ${JSON.stringify(maybeWithGuesses)}`
    );
  }
}

const invoke = (service: string) => ({ src: service });

export const orientationGuesserMachine = createMachine(
  {
    id: "orientationGuesser",
    context: {
      orientation: undefined as undefined | Orientation,
      guesses: [] as Guess[],
    },
    initial: "checking sensor API support",
    entry: isDev ? "set dummy orientation" : undefined,
    states: {
      "checking sensor API support": {
        always: [
          {
            cond: "is device motion API supported",
            target: "checking permissions",
          },
          {
            target: "unsupported device",
          },
        ],
      },
      "checking permissions": {
        always: [
          {
            cond: "device requires permission",
            target: "prompting permission",
          },
          { target: "checking sensor responsivity" },
        ],
      },
      "prompting permission": {
        on: {
          "permission requested": "requesting permission",
        },
      },
      "requesting permission": {
        invoke: invoke("request permission"),
        on: {
          "permission granted": "restoring guesses",
          "permission denied": "missing permissions",
        },
      },
      "checking sensor responsivity": {
        invoke: invoke("measure orientation"),
        on: {
          "orientation changed": {
            cond: "is valid orientation",
            target: "restoring guesses",
          },
        },
        after: isProd
          ? {
              5000: "unsupported device",
            }
          : {
              0: "restoring guesses",
            },
      },
      "restoring guesses": {
        invoke: invoke("restore persisted guesses"),
        on: {
          "restored guesses": {
            target: "guessing",
            actions: "set guesses",
          },
        },
      },
      guessing: {
        invoke: invoke("measure orientation"),
        on: {
          "orientation changed": {
            cond: "is valid orientation",
            actions: "assign orientation change",
          },
          guessed: {
            cond: "has orientation",
            target: "reviewing",
            actions: "add guess",
          },
        },
      },
      reviewing: {
        entry: "persist guesses",
        on: {
          restarted: {
            target: "guessing",
            actions: "clear orientation",
          },
        },
      },
      "missing permissions": {},
      "unsupported device": {},
    },
  },
  {
    actions: {
      // for dev purposes
      ...(isDev
        ? {
            "set dummy orientation": assign({
              orientation: (_) => ({ x: 0.1, y: -0.2 }),
            }),
          }
        : {}),
      "assign orientation change": assign({
        orientation: (_, e) => (assertOrientation(e), { x: e.x, y: e.y }),
      }),
      "add guess": assign({
        guesses: (ctx) =>
          ctx.orientation
            ? [
                ...ctx.guesses,
                {
                  ...ctx.orientation,
                  id: uuidv4(),
                  timestamp: new Date().getTime(),
                },
              ]
            : ctx.guesses,
      }),
      "clear orientation": assign({
        orientation: (_) => undefined,
      }),
      "set guesses": assign({
        guesses: (_, e) => (assertHasGuesses(e), e.guesses),
      }),
      "persist guesses": (ctx) => {
        localStorage.setItem("guesses", JSON.stringify(ctx.guesses));
      },
    },
    guards: {
      "is device motion API supported": () => !!DeviceMotionEvent,
      "has orientation": (ctx) => !!ctx.orientation,
      "is valid orientation": (_, event) => isOrientation(event),
      "device requires permission": () =>
        !!DeviceMotionEvent &&
        typeof DeviceMotionEvent.requestPermission === "function",
    },
    services: {
      "measure orientation":
        () => (send: Sender<{ type: "orientation changed" } & Orientation>) => {
          const listener = (event: DeviceOrientationEvent) => {
            if (event.beta != null && event.gamma != null) {
              send({
                type: "orientation changed",
                x: event.beta,
                y: event.gamma,
              });
            }
          };
          window.addEventListener("deviceorientation", listener);
          return () =>
            window.removeEventListener("deviceorientation", listener);
        },
      "request permission": () => (send) => {
        if (DeviceMotionEvent.requestPermission) {
          DeviceMotionEvent.requestPermission().then((res) => {
            switch (res) {
              case "granted":
                send({ type: "permission granted" });
              case "denied":
                send({ type: "permission denied" });
              case "prompt":
                send({ type: "permission prompted" });
            }
          });
        } else {
          send({ type: "permission granted" });
        }
      },
      "restore persisted guesses":
        () =>
        (send: Sender<{ type: "restored guesses"; guesses: Guess[] }>) => {
          const guesses = JSON.parse(localStorage.getItem("guesses") ?? "[]");
          send({ type: "restored guesses", guesses });
        },
    },
  }
);
