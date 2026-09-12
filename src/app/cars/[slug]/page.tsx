import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

export const revalidate = 86400; // Cache for 24 hours (ISR)

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const car = await prisma.car.findUnique({ where: { slug } });
  
  if (!car) return { title: 'Not Found' };
  
  return {
    title: `${car.year} ${car.make} ${car.model} Specs & Review`,
    description: `Detailed specifications for the ${car.year} ${car.make} ${car.model}. Engine: ${car.engine}, ${car.horsepower} HP. Fuel economy: ${car.mpgCity} MPG City / ${car.mpgHighway} MPG Highway.`,
  };
}

export default async function CarPage({ params }: Props) {
  const { slug } = await params;
  const car = await prisma.car.findUnique({ where: { slug } });

  if (!car) notFound();

  return (
    <main className="min-h-screen p-10 bg-slate-50 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="bg-rose-600 p-10 text-white">
          <p className="uppercase tracking-widest text-rose-100 font-semibold text-sm mb-2">Vehicle Specifications</p>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            {car.year} {car.make} {car.model}
          </h1>
          <p className="text-rose-100 text-lg">Detailed specs, fuel economy, and engine performance.</p>
        </div>
        
        <div className="p-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
              <p className="text-slate-500 font-medium mb-1">Engine</p>
              <p className="text-xl font-black text-slate-800">{car.engine || 'N/A'}</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
              <p className="text-slate-500 font-medium mb-1">Horsepower</p>
              <p className="text-xl font-black text-slate-800">{car.horsepower ? `${car.horsepower} HP` : 'N/A'}</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
              <p className="text-slate-500 font-medium mb-1">City MPG</p>
              <p className="text-xl font-black text-rose-600">{car.mpgCity || 'N/A'}</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
              <p className="text-slate-500 font-medium mb-1">Highway MPG</p>
              <p className="text-xl font-black text-rose-600">{car.mpgHighway || 'N/A'}</p>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Overview</h2>
          <p className="text-slate-600 text-lg leading-relaxed">
            {car.description || `The ${car.year} ${car.make} ${car.model} is equipped with a ${car.engine} engine delivering ${car.horsepower} horsepower. It offers fuel efficiency of up to ${car.mpgCity} MPG in the city and ${car.mpgHighway} MPG on the highway, making it an excellent choice for daily commuting and long trips.`}
          </p>
          
          <div className="mt-12 pt-8 border-t border-slate-100">
            <a href="/" className="text-rose-600 font-semibold hover:underline">← Back to Directory</a>
          </div>
        </div>
      </div>
    </main>
  );
}
