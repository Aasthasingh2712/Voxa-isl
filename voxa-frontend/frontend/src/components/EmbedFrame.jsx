import { useEffect, useState } from "react";
import "./embed-pages.css";

// Base URL of the Yap & Render app (run with: npm run dev -- -p 3000).
const AVATAR_BASE_URL =
  import.meta.env.VITE_SPEECH_ISL_URL || "http://localhost:3000";

// Shows one mode of the avatar app (?embed=text | ?embed=sign) as a native-looking Voxa page.
export default function EmbedFrame({ mode, id, label, title, subtitle, hint }) {
  const src = `${AVATAR_BASE_URL}/?embed=${mode}`;
  const [status, setStatus] = useState("checking"); // checking | up | down
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // no-cors: we only care whether the server answers at all.
    fetch(AVATAR_BASE_URL, { mode: "no-cors" })
      .then(() => !cancelled && setStatus("up"))
      .catch(() => !cancelled && setStatus("down"));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="section page-view" id={id}>
      <div className="container">
        <div className="section-heading-center">
          <div className="section-label">{label}</div>
          <h2 className="section-title">{title}</h2>
          <p className="section-subtitle">{subtitle}</p>
        </div>

        <div className="embed-card">
          {status === "down" ? (
            <div className="embed-message">
              <strong>Avatar server is not running.</strong>
              <span>
                Start it in a terminal:{" "}
                <code>cd speech-to-isl &amp;&amp; npm run dev -- -p 3000</code>, then
                refresh this page.
              </span>
            </div>
          ) : (
            <>
              {!loaded && <div className="embed-message">Loading…</div>}
              {status === "up" && (
                <iframe
                  title={title}
                  src={src}
                  allow="microphone; camera; autoplay"
                  onLoad={() => setLoaded(true)}
                  className="embed-frame"
                />
              )}
            </>
          )}
        </div>

        {hint && <p className="embed-hint">{hint}</p>}
      </div>
    </section>
  );
}
