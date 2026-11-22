/**
 * Every page arrives with a short rise and fade. Done in CSS, not JavaScript, so a slow
 * phone shows the page at once instead of waiting for the app to load before revealing it.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
