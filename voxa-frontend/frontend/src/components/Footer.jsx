export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <a
            href="#home"
            className="footer-logo"
          >
            VOXA
          </a>

          <p className="footer-description">
            Indian Sign Language Translator
            <br />
            Computer Vision · Text · Speech
          </p>
        </div>

        <div className="footer-links">
          <a href="#home">Home</a>
          <a href="#translator">Translator</a>
          <a href="#how-it-works">
            How It Works
          </a>
          <a href="#about">About</a>
        </div>
      </div>

      <div className="footer-bottom">
        <span>
          © {year} VOXA
        </span>

        <span>
          Indian Sign Language Translator
        </span>
      </div>
    </footer>
  );
}