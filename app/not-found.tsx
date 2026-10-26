import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card empty">
      <p>That order could not be found.</p>
      <Link href="/" className="btn">Back to orders</Link>
    </div>
  );
}
