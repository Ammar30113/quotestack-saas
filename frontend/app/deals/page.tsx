import Link from "next/link";

import { deals, formatDate } from "@/lib/mockData";

function formatCount(value: number) {
  return `${value} quote${value === 1 ? "" : "s"}`;
}

export default function DealsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Pipeline</p>
          <h1 className="text-2xl font-semibold text-white">Deals</h1>
        </div>
        <div className="pill text-slate-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Live demo data
        </div>
      </div>

      <div className="card overflow-hidden">
        <table>
          <thead>
            <tr>
              <th className="w-2/5">Deal Name</th>
              <th>Number of Quotes</th>
              <th>Last Updated</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr key={deal.id}>
                <td className="text-white">{deal.name}</td>
                <td className="text-slate-200">{formatCount(deal.quotes.length)}</td>
                <td className="text-slate-300">{formatDate(deal.lastUpdated)}</td>
                <td className="text-right">
                  <Link
                    href={`/deals/${deal.id}`}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm font-medium text-white transition hover:border-brand-400 hover:text-brand-100"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
