import { assign, createMachine, Sender } from "xstate";
import { v4 as uuidv4 } from "uuid";

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

export const orientationGuesserMachine = createMachine(
  {
    id: "orientationGuesser",
    context: {
      orientation: undefined as undefined | Orientation,
      guesses: [] as Guess[],
    },
    initial: "checking sensor API support",
    states: {
      "checking sensor API support": {
        always: [
          {
            cond: "is device motion API supported",
            target: "supported device",
          },
          {
            target: "unsupported device",
          },
        ],
      },
      "supported device": {
        initial: "checking permissions",
        states: {
          "checking permissions": {
            invoke: {
              src: "check/request permission",
            },
            on: {
              "missing permission reported": "requesting permission",
              "permission granted": "permission granted",
              "permission denied": "permission denied",
            },
          },
          "requesting permission": {
            tags: "requesting permission",
            on: {
              "system prompt requested": "awaiting system prompt",
            },
          },
          "awaiting system prompt": {
            tags: "awaiting system prompt",
            invoke: {
              src: "check/request permission",
            },
            on: {
              "permission granted": "permission granted",
              "permission denied": "permission denied",
            },
          },
          "permission granted": {
            initial: "testing sensor",
            states: {
              "testing sensor": {
                invoke: {
                  src: "measure orientation",
                },
                on: {
                  "orientation changed": "sensor operational",
                },
                after: {
                  5000: "sensor unresponsive",
                },
              },
              "sensor operational": {
                initial: "restoring guesses",
                states: {
                  "restoring guesses": {
                    invoke: {
                      src: "restore persisted guesses",
                    },
                    on: {
                      "restored guesses": {
                        target: "guessing",
                        actions: "set guesses",
                      },
                    },
                  },
                  guessing: {
                    tags: "guessing",
                    invoke: {
                      src: "measure orientation",
                    },
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
                    tags: "reviewing",
                    entry: "persist guesses",
                    on: {
                      restarted: {
                        target: "guessing",
                        actions: "clear orientation",
                      },
                    },
                  },
                },
              },
              "sensor unresponsive": {
                tags: "unsupported device",
              },
            },
          },
          "permission denied": {
            tags: "permission denied",
          },
        },
      },
      "unsupported device": {
        tags: "unsupported device",
      },
    },
  },
  {
    actions: {
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
      "check/request permission": () => (send) => {
        /* On iOS 13+, if DeviceMotionEvent.requestPermission is triggered by a user click,
         * it will trigger a system prompt to allow/deny sensor permission. If it is _not_
         * triggered by a user action, or have not previously been triggered by a user,
         * it will reject, indicating that permissions are missing.
         *
         * https://dev.to/li/how-to-requestpermission-for-devicemotion-and-deviceorientation-events-in-ios-13-46g2
         */

        if (typeof DeviceMotionEvent.requestPermission === "function") {
          DeviceMotionEvent.requestPermission()
            .then((res) => {
              switch (res) {
                case "granted":
                  send({ type: "permission granted" });
                case "denied":
                  send({ type: "permission denied" });
                case "prompt":
                  send({ type: "permission prompted" });
              }
            })
            .catch(() => {
              send({ type: "missing permission reported" });
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
