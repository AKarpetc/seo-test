import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function Home() {
  const salaries = await prisma.salary.findMany();
  const cars = await prisma.car.findMany();
  const weather = await prisma.weather.findMany();

  return (
    <main className="min-h-screen p-10 bg-slate-50 text-slate-900 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            Programmatic SEO Platform
          </h1>
          <p className="text-slate-500 text-lg">Auto-generated directories for Salaries, Cars, and Weather</p>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Salaries */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span className="text-emerald-500">💰</span> Salaries
            </h2>
            <ul className="space-y-3">
              {salaries.map(s => (
                <li key={s.id}>
                  <Link href={`/salaries/${s.slug}`} className="text-slate-600 hover:text-emerald-600 font-medium transition-colors">
                    {s.profession} in {s.city}, {s.state}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Cars */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span className="text-rose-500">🚗</span> Cars
            </h2>
            <ul className="space-y-3">
              {cars.map(c => (
                <li key={c.id}>
                  <Link href={`/cars/${c.slug}`} className="text-slate-600 hover:text-rose-600 font-medium transition-colors">
                    {c.year} {c.make} {c.model}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Weather */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span className="text-amber-500">🌤️</span> Weather
            </h2>
            <ul className="space-y-3">
              {weather.map(w => (
                <li key={w.id}>
                  <Link href={`/weather/${w.slug}`} className="text-slate-600 hover:text-amber-600 font-medium transition-colors">
                    Weather in {w.city}, {w.state}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
