import DeveloperLink from '../components/DeveloperLink';
import { go } from '../lib/nav';

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100%',
        background: '#050505',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '18px',
        fontFamily: "'Cormorant Garamond', serif",
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&display=swap"
      />
      <p style={{ margin: 0, fontSize: '13px', letterSpacing: '0.42em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.4)' }}>
        404
      </p>
      <h1 style={{ margin: 0, fontWeight: 300, fontSize: '42px', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
        Clock It
      </h1>
      <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '18px' }}>
        This page is not on the clock.
      </p>
      <button
        type="button"
        onClick={() => go('/')}
        style={{
          marginTop: '8px',
          background: 'transparent',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '999px',
          padding: '8px 16px',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '10px',
          cursor: 'pointer',
        }}
      >
        Back to the studio
      </button>
      <DeveloperLink />
    </main>
  );
}
