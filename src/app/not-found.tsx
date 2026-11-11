import Link from 'next/link';
export default function NotFound() { return <div className="empty"><h2>Not found</h2><p>This page does not exist.</p><Link href="/">Back to the feed</Link></div>; }
