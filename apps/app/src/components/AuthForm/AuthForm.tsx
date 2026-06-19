import { AlertCircle } from "lucide-react";
import { useState } from "react";

type Props = {
  onSubmit: (params: { username: string; password: string }) => void;
  isPending: boolean;
  errorMessage?: string | null;
  requireAgeConfirmation?: boolean;
  children: React.ReactNode;
};

export const AuthForm = ({
  onSubmit,
  isPending,
  errorMessage,
  requireAgeConfirmation = false,
  children,
}: Props) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [ageError, setAgeError] = useState<string | null>(null);
  const displayedError = ageError ?? errorMessage;

  return (
    <form
      className="portal-card portal-card--centered portal-form"
      onSubmit={(
        e: React.FormEvent<HTMLFormElement> & {
          nativeEvent: { submitter: HTMLButtonElement };
        },
      ) => {
        e.preventDefault();
        if (requireAgeConfirmation && !ageConfirmed) {
          setAgeError("A parent must make the account.");
          return;
        }
        setAgeError(null);
        onSubmit({ username, password });
      }}
    >
      <h1 className="portal-title">{children}</h1>
      {displayedError ? (
        <div className="portal-alert" data-tone="danger" role="alert">
          <AlertCircle className="portal-alert__icon" />
          <div className="portal-alert__body">
            <div className="portal-alert__title">Could not continue</div>
            <div>{displayedError}</div>
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

        {requireAgeConfirmation ? (
          <>
            <label className="portal-checkbox-field">
              <input
                checked={ageConfirmed}
                className="portal-checkbox"
                name="age-confirmation"
                type="checkbox"
                onChange={(e) => {
                  setAgeConfirmed(e.target.checked);
                  if (e.target.checked) {
                    setAgeError(null);
                  }
                }}
              />
              <span>I am at least 16 years old</span>
            </label>
            <p className="portal-form-note">
              <a className="portal-link" href="/data">
                Learn how Splatterboard stores data.
              </a>
            </p>
          </>
        ) : null}

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
