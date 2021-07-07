import { useMachine } from "@xstate/react";
import React from "react";
import { Guess, orientationGuesserMachine } from "./orientationGuesserMachine";

const getPoints = (guess: Guess) => (Math.abs(guess.x) + Math.abs(guess.y)) / 2;

const getMessage = (points: number) =>
  points < 0.01
    ? "Wow! Perfect!"
    : points < 0.1
    ? "Insanely good"
    : points < 1
    ? "Pretty good"
    : points < 2
    ? "Alright"
    : points < 3
    ? "Not terrible"
    : points < 4
    ? "Terrible"
    : "Awful";

const ResultsView = (props: { guesses: Guess[]; onRestart: VoidFunction }) => {
  const guess = props.guesses[props.guesses.length - 1];
  const points = getPoints(guess);
  const message = getMessage(points);

  return (
    <div className="flex justify-center pt-20">
      <div className="flex flex-col gap-12 w-80">
        <div className={"flex flex-col gap-8"}>
          <div className="flex flex-col-reverse">
            <h1 className="text-5xl">{message}</h1>
            <p className="text-lg text-gray-700">
              {guess.x.toFixed(3)}°, {guess.y.toFixed(3)}°
            </p>
          </div>
          <button
            className="p-4 text-xl text-white bg-purple-600 rounded-md"
            onClick={props.onRestart}
          >
            Retry
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-2xl">Your top 5 guesses</h2>
          <ol className="text-lg list-decimal list-inside">
            {[...props.guesses]
              .sort((a, b) => getPoints(a) - getPoints(b))
              .filter((_, idx) => idx < 5)
              .map((g) => (
                <li key={g.id}>
                  {getMessage(getPoints(g))} ({g.x.toFixed(3)}°,{" "}
                  {g.y.toFixed(3)}
                  °)
                </li>
              ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

export const App = () => {
  const [state, send] = useMachine(orientationGuesserMachine, {
    devTools: true,
  });

  return (
    <div className="App">
      {state.matches("prompting permission") && (
        <div className="flex flex-col items-center justify-center h-screen gap-8 p-8">
          <h1 className="text-lg">
            This game needs access to the motion sensor API
          </h1>
          <button
            className="p-4 text-xl text-white bg-purple-600 rounded-md "
            onClick={() => send("permission requested")}
          >
            Request permission
          </button>
        </div>
      )}
      {state.matches("requesting permission") && (
        <p className="flex flex-col items-center justify-center w-screen h-screen gap-4 text-xl">
          <span className="text-5xl">🙏</span>
          Requesting sensor permissions
        </p>
      )}
      {state.matches("guessing") && (
        <button
          className="flex items-center justify-center w-screen h-screen text-2xl text-white bg-purple-600"
          onClick={() => send("guessed")}
        >
          <span>Press to guess!</span>
        </button>
      )}
      {state.matches("reviewing") && (
        <ResultsView
          guesses={state.context.guesses}
          onRestart={() => send("restarted")}
        ></ResultsView>
      )}
      {state.matches("missing permissions") && (
        <p className="flex flex-col items-center justify-center w-screen h-screen gap-4 text-xl">
          <span className="text-5xl">🙅‍♂️</span>
          Sensor permissions denied
        </p>
      )}
      {state.matches("unsupported device") && (
        <p className="flex flex-col items-center justify-center w-screen h-screen gap-4 text-xl">
          <span className="text-5xl">🤷‍♂️</span>
          Device doesn't support device motion events. Are you not using a
          mobile device?
        </p>
      )}
    </div>
  );
};
