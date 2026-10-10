export default function DeveloperLink() {
  return (
    <a
      href="https://www.kv404.dev"
      style={{
        position: 'fixed',
        top: 'max(18px, env(safe-area-inset-top))',
        right: 'max(78px, calc(env(safe-area-inset-right) + 78px))',
        zIndex: 50,
        color: 'rgba(255,255,255,0.38)',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '10px',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        textDecoration: 'none',
      }}
    >
      Developer site
    </a>
  );
}
