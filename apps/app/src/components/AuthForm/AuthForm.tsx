import {
  loadParentalControlsState,
  type AccountSettingsInput,
  type AccountShareMode,
} from "@smalldraw/shared";
import { AlertCircle } from "lucide";
import type React from "react";
import { useState } from "react";

import { Icon } from "@/components/Icon";

type Props = {
  onSubmit: (params: {
    username: string;
    password: string;
    initialSettings?: AccountSettingsInput;
  }) => void;
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
  const localControls = loadParentalControlsState();
  const [shareMode, setShareMode] = useState<AccountShareMode>(
    localControls.shareMode,
  );
  const [pin, setPin] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [ageError, setAgeError] = useState<string | null>(null);
  const displayedError = ageError ?? errorMessage;

  return (
    <form
      className="portal-card portal-card--centered portal-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (requireAgeConfirmation && !ageConfirmed) {
          setAgeError("A parent must make the account.");
          return;
        }
        if (
          requireAgeConfirmation &&
          shareMode === "pin_required" &&
          !pin.trim()
        ) {
          setAgeError("Set a PIN before requiring a PIN for sharing.");
          return;
        }
        setAgeError(null);
        onSubmit({
          username,
          password,
          initialSettings: requireAgeConfirmation
            ? {
                shareMode,
                pinChange: pin.trim()
                  ? { type: "set", pin: pin.trim() }
                  : { type: "unchanged" },
              }
            : undefined,
        });
      }}
    >
      <h1 className="portal-title">{children}</h1>
      <p>Drawings on this device will be added to your account.</p>
      {displayedError ? (
        <div className="portal-alert" data-tone="danger" role="alert">
          <Icon icon={AlertCircle} className="portal-alert__icon" />
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
            setUsername(e.currentTarget.value);
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
            setPassword(e.currentTarget.value);
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
                  setAgeConfirmed(e.currentTarget.checked);
                  if (e.currentTarget.checked) {
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
            <fieldset className="portal-form-field">
              <legend className="portal-label">Sharing</legend>
              <label className="portal-checkbox-field">
                <input
                  checked={shareMode === "allowed"}
                  name="share-mode"
                  type="radio"
                  onChange={() => setShareMode("allowed")}
                />
                <span>Allow sharing</span>
              </label>
              <label className="portal-checkbox-field">
                <input
                  checked={shareMode === "pin_required"}
                  name="share-mode"
                  type="radio"
                  onChange={() => setShareMode("pin_required")}
                />
                <span>Allow sharing with PIN</span>
              </label>
              <label className="portal-checkbox-field">
                <input
                  checked={shareMode === "private_sync"}
                  name="share-mode"
                  type="radio"
                  onChange={() => setShareMode("private_sync")}
                />
                <span>Don’t allow sharing</span>
              </label>
            </fieldset>
            <input
              className="portal-input"
              name="parent-pin"
              placeholder="Optional PIN"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.currentTarget.value)}
            />
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
