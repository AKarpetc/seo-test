import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

export const revalidate = 86400; // Cache for 24 hours (ISR)

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const weather = await prisma.weather.findUnique({ where: { slug } });
  
  if (!weather) return { title: 'Not Found' };
  
  return {
    title: `Weather in ${weather.city}, ${weather.state} - Climate & Best Time to Visit`,
    description: `Average temperatures in ${weather.city} range from ${weather.avgTempLow}°F to ${weather.avgTempHigh}°F. The best time to visit is ${weather.bestTimeToVisit}.`,
  };
}

export default async function WeatherPage({ params }: Props) {
  const { slug } = await params;
  const weather = await prisma.weather.findUnique({ where: { slug } });

  if (!weather) notFound();

  return (
    <main className="min-h-screen p-10 bg-slate-50 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="bg-amber-500 p-10 text-white">
          <p className="uppercase tracking-widest text-amber-100 font-semibold text-sm mb-2">Climate Guide</p>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            Weather in {weather.city}{weather.state ? `, ${weather.state}` : ''}
          </h1>
          <p className="text-amber-100 text-lg">Year-round climate, temperature averages, and travel tips.</p>
        </div>
        
        <div className="p-10">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
              <p className="text-slate-500 font-medium mb-1">High Temp (Avg)</p>
              <p className="text-3xl font-black text-amber-600">{weather.avgTempHigh}°F</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
              <p className="text-slate-500 font-medium mb-1">Low Temp (Avg)</p>
              <p className="text-3xl font-black text-blue-500">{weather.avgTempLow}°F</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
              <p className="text-slate-500 font-medium mb-1">Rainy Days</p>
              <p className="text-3xl font-black text-slate-800">{weather.rainDaysPerYear || 'N/A'}</p>
              <p className="text-sm text-slate-400 mt-2">per year</p>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Best Time to Visit</h2>
          <p className="text-slate-600 text-lg leading-relaxed mb-6 font-medium">
            Based on historical climate data, the best time to visit {weather.city} is {weather.bestTimeToVisit}.
          </p>

          <p className="text-slate-600 text-lg leading-relaxed">
            {weather.description || `${weather.city} experiences a diverse climate throughout the year. With average highs around ${weather.avgTempHigh}°F and lows dipping to ${weather.avgTempLow}°F, visitors should plan their trips accordingly. The area sees roughly ${weather.rainDaysPerYear} days of precipitation annually.`}
          </p>
          
          <div className="mt-12 pt-8 border-t border-slate-100">
            <Link href="/" className="text-amber-600 font-semibold hover:underline">← Back to Directory</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
