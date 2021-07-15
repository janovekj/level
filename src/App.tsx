import { useMachine } from "@xstate/react";
import React from "react";
import { Guess, orientationGuesserMachine } from "./orientationGuesserMachine";

const getPoints = (guess: Guess) => (Math.abs(guess.x) + Math.abs(guess.y)) / 2;

const getMessage = (points: number) =>
  points < 0.01
    ? "Wow! Perfect!"
    : points < 0.1
    ? "Insanely good"
    : points < 0.5
    ? "Very good"
    : points < 1
    ? "Pretty good"
    : points < 2
    ? "Alright"
    : points < 3
    ? "Not terrible"
    : points < 4
    ? "Terrible"
    : "Awful";

const Scoreboard = (props: { guesses: Guess[]; onRestart: VoidFunction }) => {
  const guess = props.guesses[props.guesses.length - 1];

  const sortedGuesses = [...props.guesses].sort(
    (a, b) => getPoints(a) - getPoints(b)
  );

  const maxScoresCount = 10;

  const guessIndex = sortedGuesses.findIndex((g) => g.id === guess.id);

  return (
    <div className="flex justify-center pt-20">
      <div className="flex flex-col gap-12 w-80">
        <div className={"flex flex-col gap-8"}>
          <div>
            <ol className="text-xl list-decimal list-inside">
              {sortedGuesses
                .filter((_, idx) => idx < maxScoresCount)
                .map((g) => {
                  const points = getPoints(g);
                  const message = getMessage(points);

                  return g.id === guess.id ? (
                    <li key={g.id} className="text-purple-600">
                      {message} ({g.x.toFixed(3)}°, {g.y.toFixed(3)}
                      °) 👈
                    </li>
                  ) : (
                    <li key={g.id}>
                      {message} ({g.x.toFixed(3)}°, {g.y.toFixed(3)}
                      °)
                    </li>
                  );
                })}
            </ol>
            {guessIndex >= maxScoresCount ? (
              <div className="text-xl">
                <p className="text-2xl tracking-wider text-center">...</p>
                <p className="text-purple-600">
                  {guessIndex + 1}. {getMessage(getPoints(guess))} (
                  {guess.x.toFixed(3)}°,
                  {guess.y.toFixed(3)}
                  °) 👈
                </p>
              </div>
            ) : null}
          </div>
          <button
            className="p-4 text-xl text-white bg-purple-600 rounded-md"
            onClick={props.onRestart}
          >
            Retry
          </button>
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
        <Scoreboard
          guesses={state.context.guesses}
          onRestart={() => send("restarted")}
        ></Scoreboard>
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
