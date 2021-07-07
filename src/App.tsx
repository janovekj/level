import { useMachine } from "@xstate/react";
import React from "react";
import { assign, createMachine } from "xstate";

const machine = createMachine(
  {
    id: "test",
    context: {
      x: undefined as undefined | number,
      y: undefined as undefined | number,
    },
    initial: "measuring",
    states: {
      measuring: {
        invoke: {
          src: "measure orientation",
        },
        on: {
          "orientation changed": {
            actions: "set orientation",
          },
        },
      },
    },
  },
  {
    actions: {
      "set orientation": assign({
        x: (ctx, e) => e.x,
        y: (ctx, e) => e.y,
      }),
    },
    services: {
      "measure orientation": (ctx) => (send) => {
        const listener = (event: DeviceOrientationEvent) => {
          send({
            type: "orientation changed",
            x: event.beta,
            y: event.gamma,
          });
        };
        window.addEventListener("deviceorientation", listener);
        return () => window.removeEventListener("deviceorientation", listener);
      },
    },
  }
);

// export const s = interpret(machine, { devTools: true }).start();

export const App = () => {
  const [state] = useMachine(machine, {
    // devTools: true,
  });

  if (state.context.x === undefined || state.context.y === undefined) {
    return <div>not loaded</div>;
  }

  const frontLeft = state.context.x + state.context.y;
  const frontRight = state.context.x - state.context.y;

  return (
    <div className="App">
      <div>
        <div
          style={{
            display: "flex",
            fontSize: "24px",
            justifyContent: "center",
          }}
        >
          <span style={{ padding: "8px", backgroundColor: "aqua" }}>
            {frontLeft.toFixed(1)}
          </span>
          <span style={{ padding: "8px", backgroundColor: "lightgreen" }}>
            {frontRight.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
};
