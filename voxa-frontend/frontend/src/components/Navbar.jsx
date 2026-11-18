import { useState, useEffect } from "react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [hash, setHash] = useState(window.location.hash || "#home");
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || "#home");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navLinks = [
    { label: "Home", href: "#home" },
    { label: "Sign → Text", href: "#translator" },
    { label: "Text → Sign", href: "#text-to-sign" },
    { label: "Word Signs", href: "#word-signs" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "About", href: "#about" },
  ];
  const isActive = (href) => hash === href;

  return (
    <>
      <nav className={`navbar${scrolled ? " scrolled" : ""}`}>
        <a href="#home" className="navbar-logo">
          <span className="navbar-logo-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 14L10 4L16 14"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M6.5 10H13.5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          VOXA
        </a>

        <ul className="navbar-nav">
          {navLinks.map((link) => (
            <li key={link.label}>
              <a href={link.href} className={isActive(link.href) ? "active" : ""}>{link.label}</a>
            </li>
          ))}
        </ul>

        <div className="navbar-actions">
          <a href="#translator" className="btn btn-primary navbar-cta">
            Start Translating
          </a>

          <button
            className="hamburger"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span
              style={
                menuOpen
                  ? { transform: "rotate(45deg) translate(5px, 5px)" }
                  : {}
              }
            />
            <span style={menuOpen ? { opacity: 0 } : {}} />
            <span
              style={
                menuOpen
                  ? { transform: "rotate(-45deg) translate(5px, -5px)" }
                  : {}
              }
            />
          </button>
        </div>
      </nav>

      <div className={`mobile-menu${menuOpen ? " open" : ""}`}>
        {navLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className={isActive(link.href) ? "active" : ""}
            onClick={() => setMenuOpen(false)}
          >
            {link.label}
          </a>
        ))}

        <a
          href="#translator"
          className="btn btn-primary"
          style={{ marginTop: "0.5rem", justifyContent: "center" }}
          onClick={() => setMenuOpen(false)}
        >
          Start Translating
        </a>
      </div>
    </>
  );
}