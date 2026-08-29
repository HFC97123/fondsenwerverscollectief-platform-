import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

export default function Login() {
  const {
    isAuthLogin,
    showRegister,
    loginForm,
    onLoginEmail,
    onLoginPassword,
    loginLoading,
    loginError,
    login,
  } = useApp();

  if (!isAuthLogin) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    await login();
  };

  return (
    <div
      style={css(`
        background: #FFFFFF;
        border-radius: 24px;
        padding: 40px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 40px;
        align-items: center;
      `)}
    >
      <div>
        <div
          style={css(`
            font-family: 'Newsreader', serif;
            font-size: 24px;
            font-weight: 600;
            color: #2C4A5E;
            margin-bottom: 10px;
          `)}
        >
          Inloggen
        </div>

        <div
          style={css(`
            font-size: 15px;
            line-height: 1.6;
            color: #4B5C58;
          `)}
        >
          Log in om vragen te stellen, kennis te delen, uw profiel te beheren
          en toegang te krijgen tot alle ledencontent. Zonder account kunt u
          meelezen.
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={css(`display: flex; flex-direction: column; gap: 12px;`)}
      >
        <input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="E-mailadres"
          value={loginForm.email}
          onChange={onLoginEmail}
          disabled={loginLoading}
          style={css(`
            padding: 12px 16px;
            border-radius: 12px;
            border: 1.5px solid #E1EAE4;
            font-size: 14.5px;
            font-family: 'Mulish', sans-serif;
            outline: none;
          `)}
        />

        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Wachtwoord"
          value={loginForm.password}
          onChange={onLoginPassword}
          disabled={loginLoading}
          style={css(`
            padding: 12px 16px;
            border-radius: 12px;
            border: 1.5px solid #E1EAE4;
            font-size: 14.5px;
            font-family: 'Mulish', sans-serif;
            outline: none;
          `)}
        />

        {loginError ? (
          <div
            role="alert"
            style={css(`
              padding: 11px 14px;
              border-radius: 12px;
              background: #FFF2F0;
              color: #9B3A32;
              font-size: 13.5px;
              line-height: 1.5;
            `)}
          >
            {loginError}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loginLoading}
          style={css(`
            cursor: ${loginLoading ? 'default' : 'pointer'};
            width: 100%;
            border: 0;
            text-align: center;
            padding: 13px;
            background: #4E9A6C;
            color: #FFFFFF;
            border-radius: 999px;
            font-family: 'Mulish', sans-serif;
            font-weight: 700;
            font-size: 15px;
            opacity: ${loginLoading ? '0.7' : '1'};
          `)}
        >
          {loginLoading ? 'Bezig met inloggen…' : 'Inloggen'}
        </button>

        <div
          style={css(`
            text-align: center;
            font-size: 13.5px;
            color: #4B5C58;
          `)}
        >
          Nog geen lid?{' '}
          <span
            onClick={loginLoading ? undefined : showRegister}
            style={css(`
              cursor: ${loginLoading ? 'default' : 'pointer'};
              font-weight: 700;
              color: #2C4A5E;
            `)}
          >
            Word lid
          </span>
        </div>
      </form>
    </div>
  );
}
