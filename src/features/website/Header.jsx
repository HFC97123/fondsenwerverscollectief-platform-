import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

export default function Header() {
  const app = useApp();

  const {
    isHome,
    isSubpage,
    goHome,
    goNetwerk,
    goActueel,
    isAdmin,
    goAdmin,
  } = app;

  return (
    <>
      <div
        style={css(`
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(247, 249, 248, 0.9);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid #E1EAE4;
        `)}
      >
        <div
          style={css(`
            max-width: 1180px;
            margin: 0 auto;
            padding: 18px 32px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
          `)}
        >
          <div
            onClick={goHome}
            style={css(`
              display: flex;
              align-items: center;
              gap: 10px;
              cursor: pointer;
            `)}
          >
            <img
              src="/uploads/collectief-logo.png"
              alt="Het Fondsenwervers Collectief logo"
              style={css(`
                width: 56px;
                height: 56px;
                object-fit: contain;
                flex-shrink: 0;
              `)}
            />

            <div
              style={css(`
                font-family: 'Newsreader', serif;
                font-weight: 600;
                font-size: 20px;
                color: #2C4A5E;
              `)}
            >
              Het Fondsenwervers Collectief
            </div>
          </div>

          {isHome ? (
            <div
              style={css(`
                display: flex;
                align-items: center;
                gap: 28px;
              `)}
            >
              <a
                href="#voor-wie"
                style={css(`
                  font-size: 15px;
                  font-weight: 600;
                  color: #2C4A5E;
                `)}
              >
                Voor wie
              </a>

              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  goNetwerk();
                }}
                style={css(`
                  font-size: 15px;
                  font-weight: 600;
                  color: #2C4A5E;
                `)}
              >
                Collectief
              </a>

              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  goActueel();
                }}
                style={css(`
                  font-size: 15px;
                  font-weight: 600;
                  color: #2C4A5E;
                `)}
              >
                Actueel
              </a>

              {isAdmin ? (
                <button
                  type="button"
                  onClick={goAdmin}
                  style={css(`
                    border: none;
                    background: transparent;
                    padding: 0;
                    font-family: inherit;
                    font-size: 15px;
                    font-weight: 700;
                    color: #2C4A5E;
                    cursor: pointer;
                  `)}
                >
                  Beheer
                </button>
              ) : null}

              <a
                href="#/subsidie-kompas"
                style={css(`
                  padding: 10px 20px;
                  background: #4E9A6C;
                  color: #FFFFFF;
                  border-radius: 999px;
                  font-size: 15px;
                  font-weight: 700;
                `)}
              >
                Probeer Subsidie Kompas
              </a>
            </div>
          ) : null}

          {isSubpage ? (
            <div
              onClick={goHome}
              style={css(`
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-size: 15px;
                font-weight: 700;
                color: #2C4A5E;
              `)}
            >
              <span style={css(`font-size: 18px;`)}>←</span>
              Terug naar home
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
