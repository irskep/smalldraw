import { AlertCircle } from "lucide-react";
import { useState } from "react";

type Props = {
  onSubmit: (params: { username: string; password: string }) => void;
  isPending: boolean;
  errorMessage?: string | null;
  children: React.ReactNode;
};

export const AuthForm = ({
  onSubmit,
  isPending,
  errorMessage,
  children,
}: Props) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="portal-card portal-card--centered portal-form"
      onSubmit={(
        e: React.FormEvent<HTMLFormElement> & {
          nativeEvent: { submitter: HTMLButtonElement };
        },
      ) => {
        e.preventDefault();
        onSubmit({ username, password });
      }}
    >
      <h1 className="portal-title">{children}</h1>
      {errorMessage ? (
        <div className="portal-alert" data-tone="danger" role="alert">
          <AlertCircle className="portal-alert__icon" />
          <div className="portal-alert__body">
            <div className="portal-alert__title">Could not continue</div>
            <div>{errorMessage}</div>
          </div>
        </div>
      ) : null}

      <div className="portal-form-field">
        <input
          required
          name="username"
          placeholder="Username"
          type="text"
          autoComplete="off"
          className="portal-input"
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
          className="portal-input"
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
