import './LandingPage.css';

function StepCard({ number, icon, title, description }) {
  return (
    <div className="landing-step-card">
      <div className="landing-step-number">{number}</div>
      <div className="landing-step-icon">{icon}</div>
      <h3 className="landing-step-title">{title}</h3>
      <p className="landing-step-desc">{description}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="landing-feature-card">
      <div className="landing-feature-icon">{icon}</div>
      <h3 className="landing-feature-title">{title}</h3>
      <p className="landing-feature-desc">{description}</p>
    </div>
  );
}

export default function LandingPage({ onGetStarted }) {
  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">LLM Bullpen</div>
        <button className="landing-nav-signin" onClick={onGetStarted}>
          Sign In
        </button>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <h1 className="landing-hero-title">
          One question. Multiple minds.{' '}
          <strong>The best answer.</strong>
        </h1>
        <p className="landing-hero-subtitle">
          Send your query to multiple leading AI models, have them anonymously peer-review each other,
          then get a single synthesized answer that combines the best of all perspectives.
        </p>
        <button className="landing-cta" onClick={onGetStarted}>
          Get Started Free
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
          </svg>
        </button>
        <div className="landing-hero-image">
          <img src="/image.png" alt="AI models collaborating around a shared interface" />
        </div>
      </section>

      {/* How It Works */}
      <section className="landing-how">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">How It Works</h2>
          <div className="landing-steps">
            <StepCard
              number={1}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              }
              title="First Opinions"
              description="Your question is sent to multiple top AI models simultaneously. Each model provides its independent answer without seeing the others."
            />
            <StepCard
              number={2}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              title="Anonymous Peer Review"
              description="Each model reviews and ranks all responses anonymously — labeled only as Response A, B, C — preventing any name-based favoritism."
            />
            <StepCard
              number={3}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              }
              title="Synthesis"
              description="A chairman model reviews all responses and rankings, then produces a single final answer that combines the best insights from every model."
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">Why LLM Bullpen?</h2>
          <div className="landing-features-grid">
            <FeatureCard
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              }
              title="Anonymous Review"
              description="Models see only 'Response A', 'Response B' — never each other's names. This eliminates brand bias and ensures rankings are based purely on quality."
            />
            <FeatureCard
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              }
              title="Graceful Degradation"
              description="If a model fails or times out, the pipeline continues with the remaining responses. You always get an answer, even if not every model participates."
            />
            <FeatureCard
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              }
              title="Model Flexibility"
              description="Choose which models sit on your council. Mix and match providers — OpenAI, Google, Anthropic, Meta, and more — all through a single interface."
            />
            <FeatureCard
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              }
              title="Full Transparency"
              description="See every model's individual response, every peer review ranking, and the final synthesis. Nothing is hidden — you can inspect the entire process."
            />
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="landing-bottom-cta">
        <h2 className="landing-bottom-cta-title">Ready for better AI answers?</h2>
        <button className="landing-cta" onClick={onGetStarted}>
          Create Your Account
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        LLM Bullpen
      </footer>
    </div>
  );
}
