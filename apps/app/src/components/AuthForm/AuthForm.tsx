import { useState } from "react";

type Props = {
  onSubmit: (params: { username: string; password: string }) => void;
  isPending: boolean;
  children: React.ReactNode;
};

export const AuthForm = ({ onSubmit, isPending, children }: Props) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="account-card account-card--centered account-form"
      onSubmit={(
        e: React.FormEvent<HTMLFormElement> & {
          nativeEvent: { submitter: HTMLButtonElement };
        },
      ) => {
        e.preventDefault();
        onSubmit({ username, password });
      }}
    >
      <h1 className="account-title">{children}</h1>

      <div className="account-form-field">
        <input
          required
          name="username"
          placeholder="Username"
          type="text"
          autoComplete="off"
          className="account-input"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
          }}
        />

        <input
          required
          name="password"
          placeholder="Password"
          type="password"
          autoComplete="off"
          className="account-input"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
          }}
        />

        <button
          type="submit"
          className="ds-button"
          data-tone="primary"
          disabled={isPending}
        >
          {children}
        </button>
      </div>
    </form>
  );
};
